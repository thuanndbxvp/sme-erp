import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { Money } from "@/domain/money";
import { ValidationError, NotFoundError } from "@/domain/errors";
import { AuditAndSecurityHelper } from "@/lib/audit";
import {
  TRANSACTION_TYPE,
  type TransactionTypeValue,
  type CashFlowGroupValue,
} from "@/domain/constants";

/**
 * TransactionService (invariant C2).
 *
 * - PHẢI chạy trong transaction; SELECT ... FOR UPDATE account trước khi cập nhật balance.
 * - INCOME → balance += amount; EXPENSE → balance -= amount. Dùng Money, không float.
 * - OUTFLOW vượt số dư (nếu bật kiểm) → throw.
 *
 * Mỗi transaction ghi 1 dòng Transaction + cập nhật Account.balance atomic.
 */

// Prisma transaction client (không có $transaction/$connect...).
type TxClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export interface RecordTransactionInput {
  type: TransactionTypeValue;
  amount: string | number;
  accountId: string;
  cashFlowGroup?: CashFlowGroupValue;
  customerId?: string | null;
  supplierId?: string | null;
  salesOrderId?: string | null;
  purchaseOrderId?: string | null;
  description?: string | null;
  userId?: string;
  /** Nếu true, kiểm số dư tài khoản không âm sau khi EXPENSE. Mặc định false. */
  enforceBalanceCheck?: boolean;
}

export interface UpdateTransactionInput {
  type?: TransactionTypeValue;
  amount?: string | number;
  accountId?: string;
  cashFlowGroup?: CashFlowGroupValue;
  customerId?: string | null;
  supplierId?: string | null;
  description?: string | null;
  userId?: string;
}

export class TransactionService {
  /**
   * Ghi nhận thu/chi, cập nhật balance atomic.
   *
   * - SELECT ... FOR UPDATE account row.
   * - INCOME: balance += amount.
   * - EXPENSE: balance -= amount.
   * - Nếu enforceBalanceCheck=true và balance âm → throw ValidationError.
   * - Ghi 1 dòng Transaction.
   *
   * Trả về transaction vừa tạo.
   */
  static async recordTransaction(
    tx: TxClient,
    input: RecordTransactionInput,
  ) {
    // [SECURITY] Chặn sửa/tạo giao dịch vào kỳ đã khóa sổ
    await AuditAndSecurityHelper.assertNotPeriodLocked(new Date());

    if (input.amount === "0" || Number(input.amount) <= 0) {
      throw new ValidationError("Số tiền phải lớn hơn 0");
    }

    const amount = Money.of(input.amount);

    // SELECT ... FOR UPDATE — khóa row account.
    const locked = await tx.$queryRaw<
      Array<{ id: string; code: string; name: string; balance: Prisma.Decimal }>
    >`
      SELECT "id", "code", "name", "balance"
      FROM "Account"
      WHERE "id" = ${input.accountId}
      FOR UPDATE
    `;
    const account = locked[0];
    if (!account) {
      throw new NotFoundError("Account", input.accountId);
    }

    const oldBalance = Money.of(account.balance.toString());

    let newBalance: Money;
    if (input.type === TRANSACTION_TYPE.INCOME) {
      newBalance = oldBalance.add(amount);
    } else {
      // EXPENSE
      newBalance = oldBalance.sub(amount);
      if (input.enforceBalanceCheck && newBalance.isNegative()) {
        throw new ValidationError(
          `Số dư tài khoản không đủ: ${account.code} (${account.name}) — số dư ${oldBalance.toDecimalString()}, yêu cầu chi ${amount.toDecimalString()}`,
        );
      }
    }

    // Cập nhật balance account.
    await tx.account.update({
      where: { id: account.id },
      data: { balance: newBalance.toDecimalString() },
    });

    // Ghi dòng Transaction.
    AuditAndSecurityHelper.logAction({
      action: "CREATE",
      entityType: "TRANSACTION",
      entityId: "new", // Vì create chưa có ID, hoặc lưu lại response
      userId: input.userId,
      metadata: { type: input.type, amount: input.amount, accountId: input.accountId }
    });
    return tx.transaction.create({
      data: {
        type: input.type,
        amount: amount.toDecimalString(),
        accountId: input.accountId,
        cashFlowGroup: input.cashFlowGroup ?? "OPERATIONAL",
        customerId: input.customerId ?? null,
        supplierId: input.supplierId ?? null,
        salesOrderId: input.salesOrderId ?? null,
        purchaseOrderId: input.purchaseOrderId ?? null,
        description: input.description ?? null,
      },
    });
  }

  /**
   * Helper: mở transaction rồi gọi recordTransaction (cho caller không tự quản tx).
   */
  static async recordTransactionInTransaction(
    input: RecordTransactionInput,
    prisma: PrismaClient = defaultPrisma,
  ) {
    return prisma.$transaction((tx) =>
      TransactionService.recordTransaction(tx, input),
    );
  }

  /**
   * Xóa giao dịch thủ công (không gắn Order). Hoàn tác balance trước khi xóa.
   * Chỉ áp dụng cho giao dịch không liên kết salesOrderId/purchaseOrderId.
   */
  static async deleteTransaction(
    id: string,
    userId?: string,
    prisma: PrismaClient = defaultPrisma,
  ) {
    await AuditAndSecurityHelper.assertNotPeriodLocked(new Date());

    return prisma.$transaction(
      async (tx) => {
        const existing = await tx.transaction.findUnique({ where: { id } });
        if (!existing) {
          throw new NotFoundError("Transaction", id);
        }
        if (existing.salesOrderId || existing.purchaseOrderId) {
          throw new ValidationError(
            "Không thể xóa giao dịch đã gắn với đơn hàng (chỉ xóa giao dịch thủ công)",
          );
        }

        const amount = Money.of(existing.amount.toString());

        // SELECT ... FOR UPDATE account
        const locked = await tx.$queryRaw<
          Array<{ id: string; code: string; name: string; balance: Prisma.Decimal }>
        >`SELECT "id", "code", "name", "balance" FROM "Account" WHERE "id" = ${existing.accountId} FOR UPDATE`;
        const account = locked[0];
        if (!account) {
          throw new NotFoundError("Account", existing.accountId);
        }

        const oldBalance = Money.of(account.balance.toString());
        // Revert: INCOME đã cộng → giờ trừ; EXPENSE đã trừ → giờ cộng
        const newBalance =
          existing.type === TRANSACTION_TYPE.INCOME
            ? oldBalance.sub(amount)
            : oldBalance.add(amount);

        await tx.account.update({
          where: { id: account.id },
          data: { balance: newBalance.toDecimalString() },
        });

        await tx.transaction.delete({ where: { id } });

        AuditAndSecurityHelper.logAction({
          action: "DELETE",
          entityType: "TRANSACTION",
          entityId: id,
          userId,
          metadata: {
            type: existing.type,
            amount: existing.amount.toString(),
            accountId: existing.accountId,
          },
        });
      },
      { maxWait: 15_000, timeout: 20_000 },
    );
  }

  /**
   * Sửa giao dịch thủ công (không gắn Order).
   * Revert số dư cũ → apply số dư mới, atomic trong một Prisma transaction.
   * Chặn sửa nếu gắn salesOrderId/purchaseOrderId (giao dịch hệ thống).
   */
  static async updateTransaction(
    tx: TxClient,
    id: string,
    input: UpdateTransactionInput,
  ) {
    await AuditAndSecurityHelper.assertNotPeriodLocked(new Date());

    // SELECT ... FOR UPDATE bản ghi gốc (chống race).
    const existingRows = await tx.$queryRaw<
      Array<{
        id: string;
        type: TransactionTypeValue;
        amount: Prisma.Decimal;
        accountId: string;
        salesOrderId: string | null;
        purchaseOrderId: string | null;
        cashFlowGroup: string;
        customerId: string | null;
        supplierId: string | null;
        description: string | null;
      }>
    >`SELECT "id", "type", "amount", "accountId", "salesOrderId", "purchaseOrderId", "cashFlowGroup", "customerId", "supplierId", "description" FROM "Transaction" WHERE "id" = ${id} FOR UPDATE`;
    const existing = existingRows[0];
    if (!existing) {
      throw new NotFoundError("Transaction", id);
    }
    if (existing.salesOrderId || existing.purchaseOrderId) {
      throw new ValidationError(
        "Không thể sửa giao dịch đã gắn với đơn hàng (chỉ sửa giao dịch thủ công)",
      );
    }

    // Tính các field mới (giữ nguyên nếu không truyền).
    const newType = input.type ?? existing.type;
    const newAccountId = input.accountId ?? existing.accountId;
    const newAmountRaw = input.amount ?? existing.amount.toString();
    if (newAmountRaw === "0" || Number(newAmountRaw) <= 0) {
      throw new ValidationError("Số tiền phải lớn hơn 0");
    }
    const newAmount = Money.of(newAmountRaw);

    // Revert old: khóa account cũ.
    const oldLocked = await tx.$queryRaw<
      Array<{ id: string; code: string; name: string; balance: Prisma.Decimal }>
    >`SELECT "id", "code", "name", "balance" FROM "Account" WHERE "id" = ${existing.accountId} FOR UPDATE`;
    const oldAccount = oldLocked[0];
    if (!oldAccount) {
      throw new NotFoundError("Account", existing.accountId);
    }
    const oldBalance = Money.of(oldAccount.balance.toString());

    // Apply new: nếu đổi account thì khóa thêm account mới.
    let appliedAccountId = newAccountId;
    if (newAccountId === oldAccount.id) {
      // Cùng account: revert rồi apply trên cùng balance (gộp 1 lần update).
      const revertedBalance =
        existing.type === TRANSACTION_TYPE.INCOME
          ? oldBalance.sub(Money.of(existing.amount.toString()))
          : oldBalance.add(Money.of(existing.amount.toString()));
      const balanceAfterApply =
        newType === TRANSACTION_TYPE.INCOME
          ? revertedBalance.add(newAmount)
          : revertedBalance.sub(newAmount);
      await tx.account.update({
        where: { id: oldAccount.id },
        data: { balance: balanceAfterApply.toDecimalString() },
      });
    } else {
      // Khác account: revert account cũ + apply account mới (mỗi nơi khóa riêng).
      const revertedBalance =
        existing.type === TRANSACTION_TYPE.INCOME
          ? oldBalance.sub(Money.of(existing.amount.toString()))
          : oldBalance.add(Money.of(existing.amount.toString()));
      await tx.account.update({
        where: { id: oldAccount.id },
        data: { balance: revertedBalance.toDecimalString() },
      });
      const newLocked = await tx.$queryRaw<
        Array<{ id: string; code: string; name: string; balance: Prisma.Decimal }>
      >`SELECT "id", "code", "name", "balance" FROM "Account" WHERE "id" = ${newAccountId} FOR UPDATE`;
      const newAccount = newLocked[0];
      if (!newAccount) {
        throw new NotFoundError("Account", newAccountId);
      }
      const newBalanceBefore = Money.of(newAccount.balance.toString());
      const balanceAfterApply =
        newType === TRANSACTION_TYPE.INCOME
          ? newBalanceBefore.add(newAmount)
          : newBalanceBefore.sub(newAmount);
      await tx.account.update({
        where: { id: newAccount.id },
        data: { balance: balanceAfterApply.toDecimalString() },
      });
      appliedAccountId = newAccount.id;
    }

    // Update bản ghi.
    const updated = await tx.transaction.update({
      where: { id },
      data: {
        type: newType,
        amount: newAmount.toDecimalString(),
        accountId: appliedAccountId,
        cashFlowGroup: input.cashFlowGroup ?? existing.cashFlowGroup,
        customerId: input.customerId === undefined ? existing.customerId : input.customerId,
        supplierId: input.supplierId === undefined ? existing.supplierId : input.supplierId,
        description: input.description === undefined ? existing.description : input.description,
      },
    });

    AuditAndSecurityHelper.logAction({
      action: "UPDATE",
      entityType: "TRANSACTION",
      entityId: id,
      userId: input.userId,
      metadata: {
        oldAmount: existing.amount.toString(),
        newAmount: newAmount.toDecimalString(),
        oldType: existing.type,
        newType,
      },
    });

    return updated;
  }

  /**
   * Helper: mở transaction rồi gọi updateTransaction (cho caller không tự quản tx).
   */
  static async updateTransactionInTransaction(
    id: string,
    input: UpdateTransactionInput,
    prisma: PrismaClient = defaultPrisma,
  ) {
    return prisma.$transaction(
      (tx) => TransactionService.updateTransaction(tx, id, input),
      { maxWait: 15_000, timeout: 20_000 },
    );
  }
}
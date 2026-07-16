import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { Money } from "@/domain/money";
import { ValidationError } from "@/domain/errors";
import { TransactionService } from "@/services/transaction.service";
import { InvoiceService } from "@/services/invoice.service";
import { computePaymentStatus } from "@/domain/payment-status";
import {
  TRANSACTION_TYPE,
  PAYMENT_DIRECTION,
} from "@/domain/constants";
import type { PaymentDirectionValue, CashFlowGroupValue } from "@/domain/constants";

/**
 * PaymentService — recordPayment (invariant C3).
 *
 * Trong 1 transaction (với FOR UPDATE các row):
 * 1. Validate số tiền > 0
 * 2. FOR UPDATE account → tạo Transaction cập nhật balance (C2)
 * 3. FOR UPDATE từng invoice → apply payment → cập nhật paidAmount/balanceDue/status
 * 4. Tạo Payment + PaymentApplication records
 * 5. DERIVE Order.paymentStatus từ Invoice (update nếu có link)
 *
 * balanceDue ≥ 0 luôn (enforce ở InvoiceService.applyPayment).
 * KHÔNG tin client — mọi con số đều tính lại server-side.
 */

type TxClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export interface PaymentApplicationInput {
  invoiceId: string;
  appliedAmount: string;
}

export interface RecordPaymentInput {
  direction: PaymentDirectionValue;
  amount: string;
  accountId: string;
  applications: PaymentApplicationInput[];
  customerId?: string | null;
  supplierId?: string | null;
  cashFlowGroup?: CashFlowGroupValue;
  description?: string | null;
  userId?: string;
}

export class PaymentService {
  static async recordPayment(
    input: RecordPaymentInput,
    prisma: PrismaClient = defaultPrisma,
  ) {
    if (Money.of(input.amount).lte(0)) {
      throw new ValidationError("Số tiền thanh toán phải lớn hơn 0");
    }
    if (input.applications.length === 0) {
      throw new ValidationError("Cần ít nhất 1 hóa đơn để áp thanh toán");
    }

    // Tổng applied phải khớp amount
    const totalApplied = input.applications.reduce(
      (sum, a) => sum.add(a.appliedAmount),
      Money.zero(),
    );
    if (!totalApplied.eq(input.amount)) {
      throw new ValidationError(
        `Tổng áp vào hóa đơn (${totalApplied.toDecimalString()}) không khớp số tiền thanh toán (${Money.of(input.amount).toDecimalString()})`,
      );
    }

    return prisma.$transaction(
      async (tx) => {
        // 1) Ghi Transaction cập nhật balance (C2)
        const txType =
          input.direction === PAYMENT_DIRECTION.IN
            ? TRANSACTION_TYPE.INCOME
            : TRANSACTION_TYPE.EXPENSE;

        await TransactionService.recordTransaction(tx, {
          type: txType,
          amount: input.amount,
          accountId: input.accountId,
          customerId: input.customerId ?? null,
          supplierId: input.supplierId ?? null,
          cashFlowGroup: input.cashFlowGroup,
          description: input.description ?? "Thanh toán",
          userId: input.userId,
        });

        // 2) FOR UPDATE + apply payment cho từng invoice
        for (const app of input.applications) {
          await InvoiceService.applyPayment(tx, app.invoiceId, app.appliedAmount);
        }

        // 3) Tạo Payment record
        const payment = await tx.payment.create({
          data: {
            direction: input.direction,
            amount: Money.of(input.amount).toDecimalString(),
            accountId: input.accountId,
            customerId: input.customerId ?? null,
            supplierId: input.supplierId ?? null,
            description: input.description ?? null,
            applications: {
              create: input.applications.map((a) => ({
                invoiceId: a.invoiceId,
                appliedAmount: Money.of(a.appliedAmount).toDecimalString(),
              })),
            },
          },
          include: { applications: true },
        });

        // 4) Derive Order.paymentStatus từ Invoice (C3: không lưu song song 2 nguồn)
        for (const app of input.applications) {
          await deriveOrderPaymentStatus(tx, app.invoiceId);
        }

        return payment;
      },
      // Thanh toán chạm nhiều FOR UPDATE (account + N invoice) → nới timeout
      { maxWait: 15_000, timeout: 20_000 },
    );
  }

  static async recordAdvancePayment(
    input: {
      direction: PaymentDirectionValue;
      amount: string;
      accountId: string;
      customerId?: string | null;
      supplierId?: string | null;
      description?: string | null;
      userId?: string;
    },
    prisma: PrismaClient = defaultPrisma,
  ) {
    if (Money.of(input.amount).lte(0)) {
      throw new ValidationError("Số tiền phải lớn hơn 0");
    }
    return prisma.$transaction(
      async (tx) => {
        const txType =
          input.direction === PAYMENT_DIRECTION.IN
            ? TRANSACTION_TYPE.INCOME
            : TRANSACTION_TYPE.EXPENSE;

        await TransactionService.recordTransaction(tx, {
          type: txType,
          amount: input.amount,
          accountId: input.accountId,
          customerId: input.customerId ?? null,
          supplierId: input.supplierId ?? null,
          description: input.description ?? "Tạm ứng / Đặt cọc",
          userId: input.userId,
        });

        return tx.payment.create({
          data: {
            direction: input.direction,
            amount: Money.of(input.amount).toDecimalString(),
            accountId: input.accountId,
            customerId: input.customerId ?? null,
            supplierId: input.supplierId ?? null,
            description: input.description ?? "Tạm ứng / Đặt cọc",
          },
        });
      },
      { maxWait: 15_000, timeout: 20_000 },
    );
  }
}

/** Đọc invoice → cập nhật paymentStatus của order liên kết (SO hoặc PO). */
async function deriveOrderPaymentStatus(
  tx: TxClient,
  invoiceId: string,
) {
  const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
  const newStatus = computePaymentStatus(
    invoice.paidAmount.toString(),
    invoice.totalAmount.toString(),
  );

  if (invoice.salesOrderId) {
    await tx.salesOrder.update({
      where: { id: invoice.salesOrderId },
      data: { paymentStatus: newStatus },
    });
  } else if (invoice.purchaseOrderId) {
    await tx.purchaseOrder.update({
      where: { id: invoice.purchaseOrderId },
      data: { paymentStatus: newStatus },
    });
  }
}

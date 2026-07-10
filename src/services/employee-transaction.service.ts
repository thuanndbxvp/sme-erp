import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { Money } from "@/domain/money";
import { ValidationError } from "@/domain/errors";

/**
 * EmployeeTransactionService (P5-2) — tạm ứng / hoàn ứng / chi hoa hồng.
 *
 * - ADVANCE: tạm ứng (nhận tiền trước) → tăng nợ quỹ NV.
 * - REFUND: hoàn ứng (trả lại) → giảm nợ.
 * - COMMISSION_PAYOUT: chi hoa hồng từ Payout.
 * - getBalance: Σ ADVANCE - Σ REFUND - Σ COMMISSION_PAYOUT.
 *   Số dư dương = NV đang nợ quỹ (đã tạm ứng nhiều hơn hoàn).
 */

const ETYPE = { ADVANCE: "ADVANCE", REFUND: "REFUND", COMMISSION_PAYOUT: "COMMISSION_PAYOUT" } as const;

export class EmployeeTransactionService {
  static async recordAdvance(
    userId: string,
    amount: string,
    description?: string,
    prisma: PrismaClient = defaultPrisma,
  ) {
    if (Money.of(amount).lte(0)) {
      throw new ValidationError("Số tiền tạm ứng phải lớn hơn 0");
    }
    return prisma.employeeTransaction.create({
      data: {
        userId,
        type: ETYPE.ADVANCE,
        amount: Money.of(amount).toDecimalString(),
        description: description ?? null,
      },
    });
  }

  static async recordRefund(
    userId: string,
    amount: string,
    description?: string,
    prisma: PrismaClient = defaultPrisma,
  ) {
    if (Money.of(amount).lte(0)) {
      throw new ValidationError("Số tiền hoàn ứng phải lớn hơn 0");
    }
    return prisma.employeeTransaction.create({
      data: {
        userId,
        type: ETYPE.REFUND,
        amount: Money.of(amount).toDecimalString(),
        description: description ?? null,
      },
    });
  }

  static async recordCommissionPayout(
    userId: string,
    amount: string,
    description?: string,
    prisma: PrismaClient = defaultPrisma,
  ) {
    return prisma.employeeTransaction.create({
      data: {
        userId,
        type: ETYPE.COMMISSION_PAYOUT,
        amount: Money.of(amount).toDecimalString(),
        description: description ?? null,
      },
    });
  }

  /**
   * Số dư quỹ nhân viên: số tiền NV đang nợ quỹ (đã tạm ứng chưa hoàn).
   * Dương = NV nợ. Âm = quỹ nợ NV (hoàn nhiều hơn tạm ứng).
   */
  static async getFundBalance(
    userId: string,
    prisma: PrismaClient = defaultPrisma,
  ): Promise<string> {
    const rows = await prisma.employeeTransaction.findMany({
      where: { userId },
      select: { type: true, amount: true },
    });

    let advance = Money.zero();
    let refund = Money.zero();
    let commission = Money.zero();

    for (const row of rows) {
      const amt = Money.of(row.amount.toString());
      if (row.type === ETYPE.ADVANCE) advance = advance.add(amt);
      else if (row.type === ETYPE.REFUND) refund = refund.add(amt);
      else if (row.type === ETYPE.COMMISSION_PAYOUT) commission = commission.add(amt);
    }

    // Balance = ADVANCE - REFUND - COMMISSION (NV nợ quỹ)
    return advance.sub(refund).sub(commission).toDecimalString();
  }
}

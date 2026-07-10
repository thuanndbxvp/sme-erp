import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { Money } from "@/domain/money";
import { ValidationError } from "@/domain/errors";

/**
 * CommissionService (invariant C6).
 *
 * - Chỉ tính đơn DELIVERED.
 * - Key theo `salespersonId` (fallback `userId` cho đơn cũ).
 * - Payout idempotent theo @@unique([userId, periodMonth, periodYear]) → bắt P2002.
 * - Hủy đơn sau payout → trừ lại (không double-count): khi generate lại,
 *   query chỉ đếm đơn DELIVERED → đơn đã hủy tự động bị loại.
 */

/** Lấy userId từ salespersonId, fallback về userId nếu salespersonId null. */
async function resolveSalesperson(
  prisma: PrismaClient,
  salesOrderId: string,
): Promise<string | null> {
  const so = await prisma.salesOrder.findUnique({
    where: { id: salesOrderId },
    select: { salespersonId: true, userId: true },
  });
  if (!so) return null;
  return so.salespersonId ?? so.userId ?? null;
}

export class CommissionService {
  /**
   * Tính hoa hồng cho 1 đơn DELIVERED. Áp rule active đầu tiên khớp (theo product hoặc global).
   * Trả về { userId, commission, ruleName }.
   */
  static async calculateForOrder(
    salesOrderId: string,
    prisma: PrismaClient = defaultPrisma,
  ) {
    const so = await prisma.salesOrder.findUnique({
      where: { id: salesOrderId },
      include: { items: true },
    });
    if (!so || so.status !== "DELIVERED") {
      throw new ValidationError("Chỉ tính hoa hồng cho đơn đã giao (DELIVERED)");
    }
    const userId = await resolveSalesperson(prisma, salesOrderId);
    if (!userId) {
      throw new ValidationError("Đơn không có người bán (salespersonId / userId)");
    }

    // Lấy rule active (đầu tiên khớp sản phẩm hoặc không có productId = global)
    const rules = await prisma.commissionRule.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
    });

    let totalCommission = Money.zero();
    for (const item of so.items) {
      const itemSellTotal = Money.of(item.sellTotal.toString());
      const rule = rules.find((r) => !r.productId || r.productId === item.productId) ?? rules.find((r) => !r.productId) ?? null;
      if (!rule || Money.of(itemSellTotal).lt(rule.minOrderValue.toString())) continue;

      let itemCommission: Money;
      if (rule.type === "PERCENTAGE") {
        itemCommission = itemSellTotal.mul(Money.of(rule.value.toString()).toNumber() / 100);
      } else {
        // FIXED_PER_ITEM
        itemCommission = Money.of(rule.value.toString()).mul(item.qty);
      }
      totalCommission = totalCommission.add(itemCommission);
    }

    return {
      userId,
      commission: totalCommission.toDecimalString(),
      orderValue: so.totalAmount.toString(),
    };
  }

  /**
   * Tạo/sinh Payout cho 1 nhân viên trong 1 tháng.
   * Tính tổng hoa hồng từ TẤT CẢ đơn DELIVERED của salespersonId trong tháng đó.
   * Idempotent: @@unique(userId, month, year) → gọi 2 lần chỉ tạo 1 lần (bắt P2002).
   */
  static async generatePayout(
    userId: string,
    periodMonth: number,
    periodYear: number,
    prisma: PrismaClient = defaultPrisma,
  ) {
    // Tính khoảng thời gian
    const from = new Date(periodYear, periodMonth - 1, 1);
    const to = new Date(periodYear, periodMonth, 0, 23, 59, 59);

    const orders = await prisma.salesOrder.findMany({
      where: {
        status: "DELIVERED",
        deliveredDate: { gte: from, lte: to },
        OR: [{ salespersonId: userId }, { userId }],
      },
      include: { items: true },
    });

    if (orders.length === 0) {
      return null; // không có đơn nào
    }

    let totalCommission = Money.zero();
    for (const so of orders) {
      try {
        const result = await CommissionService.calculateForOrder(so.id, prisma);
        totalCommission = totalCommission.add(result.commission);
      } catch {
        // bỏ qua đơn không tính được (vd thiếu salesperson)
      }
    }

    try {
      return await prisma.payout.create({
        data: {
          userId,
          periodMonth,
          periodYear,
          commission: totalCommission.toDecimalString(),
          orderCount: orders.length,
          status: "PENDING",
        },
      });
    } catch (err: unknown) {
      if (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code: string }).code === "P2002"
      ) {
        // Idempotent: payout đã tồn tại
        return prisma.payout.findUnique({
          where: { userId_periodMonth_periodYear: { userId, periodMonth, periodYear } },
        });
      }
      throw err;
    }
  }
}

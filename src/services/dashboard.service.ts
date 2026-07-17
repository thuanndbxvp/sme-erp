import { prisma } from "@/lib/prisma";

/**
 * Period cho P&L chart:
 * - month: group theo NGÀY trong tháng hiện tại (granularity = day).
 * - quarter: group theo THÁNG trong quý hiện tại (granularity = month, 3 tháng).
 * - year: group theo THÁNG trong năm hiện tại (granularity = month, 12 tháng).
 */
export type PlPeriod = "month" | "quarter" | "year";

export interface PlBucket {
  label: string;       // "T2" | "Tháng 3" | "01/06" — trục X
  revenue: number;     // VND
  expense: number;     // VND
  profit: number;      // = revenue - expense
  sortKey: number;     // epoch ms để sort khi fill bucket rỗng
}

export class DashboardService {
  static async getExecutiveStats() {
    const liveDate = new Date("2026-07-10T00:00:00Z");

    // 1. Lấy Tổng tiền hiện có (Tiền tươi)
    const accounts = await prisma.account.aggregate({
      _sum: { balance: true },
      where: { isActive: true },
    });
    const totalCash = accounts._sum.balance?.toNumber() || 0;

    // 2. Lấy Tổng Phải Thu (AR) và Phải Trả (AP)
    const receivables = await prisma.invoice.aggregate({
      _sum: { balanceDue: true },
      where: { type: "AR", status: { in: ["OPEN", "PARTIAL"] } },
    });
    const totalAR = receivables._sum.balanceDue?.toNumber() || 0;

    const payables = await prisma.invoice.aggregate({
      _sum: { balanceDue: true },
      where: { type: "AP", status: { in: ["OPEN", "PARTIAL"] } },
    });
    const totalAP = payables._sum.balanceDue?.toNumber() || 0;

    // 3. Lãi gộp trong tháng hiện tại
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const profitData = await prisma.salesOrderItem.aggregate({
      _sum: { profit: true },
      where: {
        salesOrder: {
          saleDate: { gte: startOfMonth },
          status: { in: ["DELIVERED"] }, // Chỉ tính đơn đã giao
          createdAt: { gte: liveDate }
        }
      }
    });
    const monthlyProfit = profitData._sum.profit?.toNumber() || 0;

    return {
      totalCash,
      totalAR,
      totalAP,
      netCashflow: totalCash + totalAR - totalAP,
      monthlyProfit
    };
  }

  /**
   * Tính P&L theo period. Group Transaction (INCOME/EXPENSE) theo bucket.
   * Fill bucket rỗng (0) để biểu đồ đủ điểm — quan trọng cho UI.
   *
   * Chỉ tính Transaction trong kỳ — KHÔNG lẫn Invoice balanceDue (đã count trong AR/AP).
   */
  static async getProfitAndLoss(period: PlPeriod): Promise<PlBucket[]> {
    const now = new Date();
    let start: Date;
    let end: Date;
    let granularity: "day" | "month";

    if (period === "month") {
      // Từ đầu tháng → cuối tháng
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      granularity = "day";
    } else if (period === "quarter") {
      // Quý hiện tại (Q1: 0-2, Q2: 3-5, Q3: 6-8, Q4: 9-11)
      const qStart = Math.floor(now.getMonth() / 3) * 3;
      start = new Date(now.getFullYear(), qStart, 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), qStart + 3, 0, 23, 59, 59, 999);
      granularity = "month";
    } else {
      // Năm nay
      start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      granularity = "month";
    }

    const liveDate = new Date("2026-07-10T00:00:00Z");
    const txns = await prisma.transaction.findMany({
      where: { date: { gte: start < liveDate ? liveDate : start, lte: end } },
      select: { type: true, amount: true, date: true },
    });

    // Group theo bucket
    const buckets = new Map<string, PlBucket>();
    function bucketKey(d: Date): { key: string; sortKey: number; label: string } {
      if (granularity === "day") {
        const ymd = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
        return {
          key: ymd,
          sortKey: new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(),
          label: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`,
        };
      }
      const ym = `${d.getFullYear()}-${d.getMonth() + 1}`;
      return {
        key: ym,
        sortKey: new Date(d.getFullYear(), d.getMonth(), 1).getTime(),
        label: `T${d.getMonth() + 1}`,
      };
    }

    for (const t of txns) {
      const k = bucketKey(t.date);
      let b = buckets.get(k.key);
      if (!b) {
        b = { label: k.label, sortKey: k.sortKey, revenue: 0, expense: 0, profit: 0 };
        buckets.set(k.key, b);
      }
      const amt = Number(t.amount.toString());
      if (t.type === "INCOME") b.revenue += amt;
      else if (t.type === "EXPENSE") b.expense += amt;
      b.profit = b.revenue - b.expense;
    }

    // Fill bucket rỗng để UI hiển thị đủ trục X
    if (granularity === "day") {
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const k = bucketKey(d);
        if (!buckets.has(k.key)) buckets.set(k.key, { label: k.label, sortKey: k.sortKey, revenue: 0, expense: 0, profit: 0 });
      }
    } else {
      const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
      const monthEnd = new Date(end.getFullYear(), end.getMonth(), 1);
      for (let d = new Date(monthStart); d <= monthEnd; d.setMonth(d.getMonth() + 1)) {
        const k = bucketKey(d);
        if (!buckets.has(k.key)) buckets.set(k.key, { label: k.label, sortKey: k.sortKey, revenue: 0, expense: 0, profit: 0 });
      }
    }

    return Array.from(buckets.values()).sort((a, b) => a.sortKey - b.sortKey);
  }
}

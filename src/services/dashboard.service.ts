import { prisma } from "@/lib/prisma";

export class DashboardService {
  static async getExecutiveStats() {
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
          status: { in: ["DELIVERED"] } // Chỉ tính đơn đã giao
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
}

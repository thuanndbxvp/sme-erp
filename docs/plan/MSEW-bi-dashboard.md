# MSEW: Micro-Step Execution Workflow (Executive BI Dashboard)

> **Gửi Tầng 2 (Coder):** Chú ý sử dụng Prisma `aggregate` để tối ưu truy vấn. Không fetch mảng data lớn.

## Bước 1: Tạo `DashboardService`
Tạo file mới tại `src/services/dashboard.service.ts` với nội dung:

```typescript
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
```

## Bước 2: Hiển thị lên Dashboard Page
Mở file `src/app/(dashboard)/page.tsx` (hoặc `src/app/page.tsx` tùy cấu trúc hiện tại) và thay bằng:

```tsx
import { DashboardService } from "@/services/dashboard.service";

export default async function DashboardPage() {
  const stats = await DashboardService.getExecutiveStats();

  // Helper format tiền
  const formatVND = (val: number) => 
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Trung tâm Điều hành SME</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card Tiền Mặt */}
        <div className="p-6 bg-white rounded-xl shadow border border-gray-100">
          <h3 className="text-gray-500 text-sm font-medium">Tiền tươi (Cash)</h3>
          <p className="text-2xl font-bold text-gray-900 mt-2">{formatVND(stats.totalCash)}</p>
        </div>

        {/* Card Phải Thu */}
        <div className="p-6 bg-white rounded-xl shadow border border-gray-100">
          <h3 className="text-gray-500 text-sm font-medium">Khoản Phải Thu (AR)</h3>
          <p className="text-2xl font-bold text-blue-600 mt-2">{formatVND(stats.totalAR)}</p>
        </div>

        {/* Card Phải Trả */}
        <div className="p-6 bg-white rounded-xl shadow border border-gray-100">
          <h3 className="text-gray-500 text-sm font-medium">Khoản Phải Trả (AP)</h3>
          <p className="text-2xl font-bold text-red-600 mt-2">{formatVND(stats.totalAP)}</p>
        </div>

        {/* Card Lãi Gộp */}
        <div className="p-6 bg-white rounded-xl shadow border border-gray-100">
          <h3 className="text-gray-500 text-sm font-medium">Lãi Gộp (Tháng này)</h3>
          <p className="text-2xl font-bold text-green-600 mt-2">{formatVND(stats.monthlyProfit)}</p>
        </div>
      </div>

      <div className="mt-8 p-6 bg-gray-50 rounded-xl border border-gray-200">
        <h2 className="text-lg font-bold text-gray-800">Cảnh báo Dòng tiền dự kiến:</h2>
        <p className={`text-3xl font-extrabold mt-3 ${stats.netCashflow < 0 ? 'text-red-600' : 'text-green-600'}`}>
          {formatVND(stats.netCashflow)}
        </p>
        <p className="text-sm text-gray-500 mt-2">Công thức sinh tồn = Tiền Cash + Tiền Phải Thu - Tiền Phải Trả</p>
      </div>
    </div>
  );
}
```

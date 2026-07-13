import { auth } from "@/lib/auth";
import { DashboardService } from "@/services/dashboard.service";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();
  const stats = await DashboardService.getExecutiveStats();

  let userRole = "GUEST";
  if (session?.user?.id) {
    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: { select: { name: true } } }
    });
    if (dbUser?.role?.name) {
      userRole = dbUser.role.name;
    }
  }

  const isAdminOrAccountant = ["ADMIN", "ACCOUNTANT"].includes(userRole);

  const topAR = await prisma.invoice.findMany({
    where: { type: "AR", status: { in: ["OPEN", "PARTIAL"] } },
    orderBy: { balanceDue: 'desc' },
    take: 5,
    include: { customer: true }
  });

  const topAP = await prisma.invoice.findMany({
    where: { type: "AP", status: { in: ["OPEN", "PARTIAL"] } },
    orderBy: { balanceDue: 'desc' },
    take: 5,
    include: { supplier: true }
  });

  const lowStock = await prisma.product.findMany({
    where: { quantity: { lt: 10 } },
    orderBy: { quantity: 'asc' },
    take: 5
  });

  const formatVND = (val: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Trung tâm Điều hành SME</h1>
        <p className="text-slate-500 mt-2">Tổng quan tình hình kinh doanh và tài chính thời gian thực.</p>
      </div>

      {/* --- CARDS TỔNG QUAN --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <div className="p-6 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-500 text-sm font-semibold uppercase tracking-wider">Tiền mặt (Cash)</h3>
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">💵</div>
          </div>
          <p className="text-3xl font-black text-slate-900">{formatVND(stats.totalCash)}</p>
        </div>

        <div className="p-6 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-500 text-sm font-semibold uppercase tracking-wider">Phải thu (AR)</h3>
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">📈</div>
          </div>
          <p className="text-3xl font-black text-blue-600">{formatVND(stats.totalAR)}</p>
        </div>

        <div className="p-6 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-500 text-sm font-semibold uppercase tracking-wider">Phải trả (AP)</h3>
            <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">📉</div>
          </div>
          <p className="text-3xl font-black text-rose-600">{formatVND(stats.totalAP)}</p>
        </div>

        {userRole === "ADMIN" && (
          <div className="p-6 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-slate-500 text-sm font-semibold uppercase tracking-wider">Lãi Gộp Tháng Này</h3>
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">💰</div>
            </div>
            <p className="text-3xl font-black text-indigo-600">{formatVND(stats.monthlyProfit)}</p>
          </div>
        )}
      </div>

      {/* --- CẢNH BÁO DÒNG TIỀN --- */}
      {isAdminOrAccountant && (
        <div className={`p-8 rounded-2xl border ${stats.netCashflow < 0 ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200'}`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Cảnh báo Dòng tiền dự kiến (Net Cashflow)</h2>
              <p className="text-sm text-slate-500 mt-1">Công thức sinh tồn = Tiền Cash + Tiền Phải Thu - Tiền Phải Trả</p>
            </div>
            <div className={`text-4xl md:text-5xl font-black ${stats.netCashflow < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {formatVND(stats.netCashflow)}
            </div>
          </div>
        </div>
      )}

      {/* --- WIDGETS CHI TIẾT --- */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* Widget Phải Thu */}
        {isAdminOrAccountant && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h3 className="font-bold text-slate-800">Top Phải Thu (AR)</h3>
              <Link href="/debts" className="text-sm text-blue-600 hover:underline font-medium">Xem tất cả</Link>
            </div>
            <div className="p-0 flex-1">
              {topAR.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-sm">Không có khoản nợ nào</div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {topAR.map(inv => (
                    <li key={inv.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div className="truncate pr-4">
                        <p className="text-sm font-semibold text-slate-900 truncate">{inv.customer?.name || "Khách lẻ"}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{inv.invoiceNumber}</p>
                      </div>
                      <div className="text-right whitespace-nowrap">
                        <p className="text-sm font-bold text-blue-600">{formatVND(inv.balanceDue.toNumber())}</p>
                        <p className="text-xs text-slate-400 mt-0.5">({Math.floor((Date.now() - inv.createdAt.getTime()) / (1000 * 60 * 60 * 24))} ngày tuổi)</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* Widget Phải Trả */}
        {isAdminOrAccountant && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h3 className="font-bold text-slate-800">Top Phải Trả (AP)</h3>
              <Link href="/debts" className="text-sm text-blue-600 hover:underline font-medium">Xem tất cả</Link>
            </div>
            <div className="p-0 flex-1">
              {topAP.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-sm">Không có khoản nợ nào</div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {topAP.map(inv => (
                    <li key={inv.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div className="truncate pr-4">
                        <p className="text-sm font-semibold text-slate-900 truncate">{inv.supplier?.name || "Nhà CC"}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{inv.invoiceNumber}</p>
                      </div>
                      <div className="text-right whitespace-nowrap">
                        <p className="text-sm font-bold text-rose-600">{formatVND(inv.balanceDue.toNumber())}</p>
                        <p className="text-xs text-slate-400 mt-0.5">({Math.floor((Date.now() - inv.createdAt.getTime()) / (1000 * 60 * 60 * 24))} ngày tuổi)</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* Widget Tồn kho cảnh báo */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <h3 className="font-bold text-slate-800">Cảnh báo Tồn kho</h3>
            <Link href="/catalog/product" className="text-sm text-blue-600 hover:underline font-medium">Tới kho</Link>
          </div>
          <div className="p-0 flex-1">
            {lowStock.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-sm">Kho hàng an toàn</div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {lowStock.map(p => (
                  <li key={p.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="truncate pr-4">
                      <p className="text-sm font-semibold text-slate-900 truncate">{p.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">Mã: {p.code}</p>
                    </div>
                    <div className="text-right whitespace-nowrap">
                      <p className={`text-sm font-bold ${p.quantity === 0 ? 'text-rose-600' : 'text-amber-500'}`}>
                        Còn {p.quantity} {p.unit}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

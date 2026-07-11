import { auth } from "@/lib/auth";
import { DashboardService } from "@/services/dashboard.service";

export default async function DashboardPage() {
  const session = await auth();
  const stats = await DashboardService.getExecutiveStats();
  const userRole = (session?.user as { role?: string } | undefined)?.role;
  const isAdminOrAccountant = ["ADMIN", "ACCOUNTANT"].includes(userRole || "");

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

        {/* Thẻ Lãi Gộp chỉ hiển thị cho Giám đốc (ADMIN) */}
        {userRole === "ADMIN" && (
          <div className="p-6 bg-white rounded-xl shadow border border-gray-100">
            <h3 className="text-gray-500 text-sm font-medium">Lãi Gộp (Tháng này)</h3>
            <p className="text-2xl font-bold text-green-600 mt-2">{formatVND(stats.monthlyProfit)}</p>
          </div>
        )}
      </div>

      {/* Cảnh báo Dòng tiền dự kiến chỉ hiển thị cho ADMIN hoặc ACCOUNTANT */}
      {isAdminOrAccountant && (
        <div className="mt-8 p-6 bg-gray-50 rounded-xl border border-gray-200">
          <h2 className="text-lg font-bold text-gray-800">Cảnh báo Dòng tiền dự kiến:</h2>
          <p className={`text-3xl font-extrabold mt-3 ${stats.netCashflow < 0 ? 'text-red-600' : 'text-green-600'}`}>
            {formatVND(stats.netCashflow)}
          </p>
          <p className="text-sm text-gray-500 mt-2">Công thức sinh tồn = Tiền Cash + Tiền Phải Thu - Tiền Phải Trả</p>
        </div>
      )}
    </div>
  );
}

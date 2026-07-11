# MSEW: Micro-Step Execution Workflow (RBAC & UI Polish)

> **Gửi Tầng 2 (Coder):** Thao tác cẩn thận, không làm gãy Sidebar đang có, chỉ thêm logic lọc dữ liệu.

## Bước 1: Áp dụng RBAC vào cấu hình Menu
Mở file `src/components/layout/Sidebar.tsx` (hoặc file chứa cấu hình danh sách Menu của Sidebar).
Định nghĩa lại cấu trúc mảng Menu, bổ sung thêm thuộc tính `allowedRoles`.

Ví dụ mã nguồn cần cập nhật (Sửa linh hoạt theo code hiện có):

```tsx
import { useSession } from "next-auth/react"; 
// (Hoặc import { auth } from "@/lib/auth" nếu Sidebar là Server Component)
import Link from "next/link";

// Định nghĩa cấu trúc Menu
const MENU_ITEMS = [
  {
    title: "KINH DOANH",
    items: [
      { name: "Đơn hàng", path: "/orders", allowedRoles: ["ADMIN", "SALE", "ACCOUNTANT"] },
      { name: "Sản phẩm", path: "/products", allowedRoles: ["ADMIN", "SALE", "ACCOUNTANT"] },
    ]
  },
  {
    title: "TÀI CHÍNH",
    items: [
      { name: "Sổ quỹ / Tài chính", path: "/cashflow", allowedRoles: ["ADMIN", "ACCOUNTANT"] },
      { name: "Công nợ", path: "/debts", allowedRoles: ["ADMIN", "ACCOUNTANT"] },
    ]
  },
  {
    title: "BÁO CÁO",
    items: [
      { name: "Báo cáo tổng quan", path: "/reports", allowedRoles: ["ADMIN"] }, // Sale tuyệt đối không được xem
    ]
  }
];

export function Sidebar() {
  const { data: session } = useSession();
  const userRole = session?.user?.role || "GUEST"; // Đọc role từ session

  return (
    <aside className="w-[var(--sidebar-width)] bg-[#111827] text-white min-h-screen flex flex-col shadow-2xl">
      <div className="p-4 flex items-center gap-3 border-b border-gray-800">
        <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-lg shadow-lg">E</div>
        <div>
          <h2 className="font-bold tracking-wider">SME ERP</h2>
          <p className="text-xs text-gray-400">Hệ thống quản trị</p>
        </div>
      </div>

      <nav className="flex-1 p-4 overflow-y-auto space-y-6">
        {MENU_ITEMS.map((group) => {
          // Chỉ lấy các item mà user có quyền xem
          const visibleItems = group.items.filter(item => item.allowedRoles.includes(userRole));
          
          if (visibleItems.length === 0) return null; // Nếu không có item nào được phép, giấu luôn cả Group Title

          return (
            <div key={group.title}>
              <h3 className="text-xs font-bold text-gray-500 mb-3 tracking-widest">{group.title}</h3>
              <ul className="space-y-1">
                {visibleItems.map(item => (
                  <li key={item.path}>
                    <Link 
                      href={item.path}
                      className="block px-3 py-2 rounded-md text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-all duration-200"
                    >
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>
      
      {/* Khung User Profile bên dưới */}
      <div className="p-4 border-t border-gray-800 bg-gray-900">
         <p className="text-sm font-semibold">{session?.user?.name || "Người dùng"}</p>
         <p className="text-xs text-gray-400">{userRole}</p>
      </div>
    </aside>
  );
}
```

## Bước 2: Ẩn các Widget nhạy cảm trên Dashboard
Mở file `src/app/(dashboard)/page.tsx` (tạo ở Lựa chọn 2).
Bọc các Widget Tài chính bằng lệnh check Role:

```tsx
// Thêm import và lấy session
import { auth } from "@/lib/auth";
// ...
export default async function DashboardPage() {
  const session = await auth();
  const isAdminOrAccountant = ["ADMIN", "ACCOUNTANT"].includes(session?.user?.role || "");

  return (
    // ...
    {/* Thẻ Lãi Gộp chỉ hiển thị cho Giám đốc (ADMIN) */}
    {session?.user?.role === "ADMIN" && (
      <div className="p-6 bg-white rounded-xl shadow border border-gray-100">
        <h3 className="text-gray-500 text-sm font-medium">Lãi Gộp (Tháng này)</h3>
        <p className="text-2xl font-bold text-green-600 mt-2">{formatVND(stats.monthlyProfit)}</p>
      </div>
    )}
    // ...
  )
}
```

# PLAN: Refactor App Routing (Route Groups)

## Kiến trúc tổng quan
Giải quyết dứt điểm vấn đề "rò rỉ" Sidebar ra các trang Public (như `/login`). 
Chúng ta sẽ áp dụng tính năng **Route Groups** của Next.js (thư mục bọc trong dấu ngoặc đơn). Route Group cho phép chúng ta chia sẻ chung một `layout.tsx` (chứa Sidebar) cho các trang nội bộ mà **không làm thay đổi đường dẫn URL** (URL vẫn là `/orders` chứ không bị biến thành `/dashboard/orders`).

**Quyết định kiến trúc:**
1. **Tách Layout:**
   - `src/app/layout.tsx` (RootLayout): Trở thành bộ khung HTML/CSS thuần túy.
   - `src/app/(dashboard)/layout.tsx`: Trở thành khung làm việc (Workspace) chứa `<Sidebar />` và Main Content.
2. **Quy hoạch Module:** Di dời tất cả các thư mục chức năng của ERP vào trong `(dashboard)`, trừ các thư mục Public như `login` và thư mục hệ thống `api`.

## Luồng dữ liệu (Data Flow)
- Truy cập `/login` -> Next.js gọi `RootLayout` -> Render Màn hình đăng nhập trống trơn (An toàn tuyệt đối).
- Truy cập `/orders` -> Next.js gọi `RootLayout` -> Gọi tiếp `(dashboard)/layout.tsx` -> Render Sidebar + Nội dung Đơn hàng.

## Danh sách thao tác
1. Tạo thư mục `src/app/(dashboard)`.
2. Tạo file `src/app/(dashboard)/layout.tsx`.
3. Cập nhật file `src/app/layout.tsx` (xóa Sidebar).
4. Di chuyển các module: `cashflow`, `catalog`, `customers`, `debts`, `orders`, `products`, `profile`, `reports`, `roles`, `suppliers`, `users`, `audit` và `page.tsx` (trang chủ) vào trong `(dashboard)/`.

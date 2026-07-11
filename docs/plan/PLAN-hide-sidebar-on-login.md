# PLAN: Ẩn Sidebar ở trang Login

## Kiến trúc tổng quan
Sếp đang gặp lỗi cơ bản của Next.js App Router: Layout gốc (`RootLayout`) sẽ được áp dụng cho **tất cả** các trang, bao gồm cả `/login`. Do file `src/app/layout.tsx` đang nhúng trực tiếp thẻ `<Sidebar />` không qua điều kiện nào nên trang đăng nhập mới bị dính Sidebar.

**Quyết định kiến trúc của Tầng 1:**
Theo nguyên tắc "không đập đi xây lại", thay vì phải dời 15 thư mục module (orders, products, users...) vào một Route Group `(dashboard)` rất dễ gây lỗi git conflict, tôi chọn phương án **Client Layout Wrapper**. Phương pháp này cực kỳ an toàn, chỉ tách phần render giao diện chung ra một Client Component nhỏ để đọc được `pathname`.

## Luồng dữ liệu (Data flow)
1. Next.js load `src/app/layout.tsx` (Server Component).
2. Layout này truyền `children` vào một component mới là `<AppLayout>`.
3. `<AppLayout>` (Client Component) gọi hook `usePathname()`.
   - Nếu `pathname === "/login"`, trả về màn hình full-screen không có Sidebar.
   - Nếu khác `/login`, render `<Sidebar />` cùng giao diện Dashboard chuẩn.

## Danh sách file cần sửa
1. **Tạo mới:** `src/components/layout/AppLayout.tsx`
2. **Cập nhật:** `src/app/layout.tsx`

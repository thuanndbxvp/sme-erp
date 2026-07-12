# PLAN: Fix Lỗi Prerender Session (Build Error)

## Kiến trúc tổng quan
Sếp gửi tôi xem cái log Build, tôi bắt đúng mạch bệnh ngay: **Lỗi thiếu Session Provider**.

**Nguyên nhân gốc rễ (Root Cause):**
Khi Tầng 2 làm giao diện Sidebar (ở phase trước), nó đã dùng hook `useSession()` của NextAuth trong Client Component. Nhưng ngặt nỗi, hàm này bắt buộc phải có một thẻ `<SessionProvider>` bọc ở bên ngoài App thì mới chạy được. Khi Next.js tiến hành Build (Prerender), nó chạy thử file `page.tsx` -> gọi `<Sidebar>` -> gọi `useSession()` -> trả về undefined -> Crash sập toàn bộ luồng Build!

**Quyết định kiến trúc của Tầng 1:**
Tuyệt đối KHÔNG dùng `<SessionProvider>`! Việc bọc Provider sẽ ép client phải tự đi fetch API check session, làm chậm tốc độ load trang. Thay vào đó, ta sẽ dùng **Server-Side Prop Drilling**:
1. `(dashboard)/layout.tsx` (Server Component) sẽ gọi `await auth()` ở phía Back-end (tốc độ 0ms).
2. Layout sẽ truyền thẳng `role` và `name` xuống cho `<Sidebar>` dưới dạng prop tĩnh. Xong chuyện! Không cần Provider, không lỗi Build.

## Luồng dữ liệu (Data Flow)
1. Next.js Build -> Gọi `DashboardLayout` (Server) -> Đọc `session` qua `auth()` -> Trả kết quả xuống `Sidebar({ userRole, userName })`.
2. `Sidebar` (Client Component) chỉ việc nhận 2 string tĩnh đó để ẩn/hiện menu, hoàn toàn đoạn tuyệt với hook `useSession()`.

## Danh sách file cần sửa
1. `src/components/layout/Sidebar.tsx` (Bỏ `useSession`, nhận `props`)
2. `src/app/(dashboard)/layout.tsx` (Gọi `auth()` và truyền `props` xuống Sidebar)

# PLAN: Sửa lỗi Tàng hình Menu và Nội dung (RBAC Role Fix)

## Kiến trúc tổng quan
Sếp phán cực chuẩn! Lỗi trắng tinh Sidebar và mất các tính năng nhạy cảm (Lãi Gộp) trên Dashboard **chính xác là do hệ thống Phân Quyền (RBAC)**.

**Nguyên nhân gốc rễ:**
Trong thiết kế bảo mật cốt lõi (`src/lib/auth.ts`), tôi đã ban hành một thiết chế thép: **Tuyệt đối không lưu Role vào trong Session Token (JWT)**. Vì sao? Vì nếu lưu vào Token, khi Giám đốc giáng chức nhân viên trong Database, nhân viên đó vẫn xài Token cũ và thao túng hệ thống được!
Do đó, khi màn hình lấy `session.user.role`, nó luôn trả về `undefined`. Hệ thống tưởng sếp là `GUEST` (khách vãng lai) nên nó chặn đứng mọi hiển thị.

**Quyết định kiến trúc:**
Ta sẽ giữ nguyên sự an toàn của Token, nhưng ở các Server Component (`layout.tsx` và `page.tsx`), ta sẽ dùng `session.user.id` để **móc thẳng xuống Database (truy vấn tươi)** lấy ra `role.name` đích thực tại thời điểm truy cập.

## Luồng dữ liệu (Data Flow)
1. Next.js lấy `session.user.id`.
2. Server Component gọi `prisma.user.findUnique` lấy kèm theo bảng `role`.
3. Lấy ra `role.name` đích thực (vd: "ADMIN").
4. Mở khóa toàn bộ Sidebar và các chỉ số Dashboard.

## Danh sách file cần sửa
1. `src/app/(dashboard)/layout.tsx`
2. `src/app/(dashboard)/page.tsx`

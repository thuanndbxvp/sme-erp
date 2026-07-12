# PLAN: Sửa lỗi Build và Cache Next.js

## Kiến trúc tổng quan
Sếp đã gặp 2 cụm lỗi rất đặc trưng khi làm việc với Next.js và Prisma trên môi trường Dev:

1. **Lỗi 1: `Type error: Property 'role' does not exist`**
   - **Nguyên nhân:** NextAuth (Auth.js) có một thiết kế cực kỳ chặt chẽ về Type-safe. Mặc định đối tượng `session.user` của NextAuth chỉ chứa `name`, `email`, và `image`. Khi ở Phase trước ta gọi `session?.user?.role`, Typescript lập tức báo lỗi đỏ lòm vì nó không tìm thấy thuộc tính `role` trong định nghĩa của NextAuth.
   - **Giải pháp:** Sử dụng kỹ thuật *TypeScript Module Augmentation* để ghi đè (override) và ép NextAuth phải "công nhận" thêm thuộc tính `role` vào `Session` và `JWT`.

2. **Lỗi 2: `ENOENT: no such file` và `PostgreSQL ConnectionReset`**
   - **Nguyên nhân:** Khi Tầng 2 thực thi lệnh Move dời hàng loạt 15 thư mục vào `(dashboard)` ở Phase 2, tiến trình `npm run dev` đang chạy ngầm bị "sốc". Next.js không tìm thấy file cũ để biên dịch (ENOENT). Kéo theo đó tiến trình Outbox worker bị lỗi treo và Prisma rớt mạng (ConnectionReset).
   - **Giải pháp:** Rất đơn giản, đây là lỗi "bóng ma" của bộ nhớ đệm (Cache). Chỉ cần tắt Dev server, dọn dẹp thư mục `.next` và chạy lại là sạch bóng quân thù.

## Luồng dữ liệu khắc phục (Data Flow)
1. **Typescript:** Cập nhật file `src/types/next-auth.d.ts`. Bơm thêm trường `role?: string` vào Interface `Session` và `JWT`.
2. **Hạ tầng Dev:** Kill tiến trình `node`, xóa `.next` rác, khởi động lại hệ thống.

## Danh sách file cần sửa
1. `src/types/next-auth.d.ts`

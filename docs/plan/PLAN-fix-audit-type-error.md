# PLAN: Sửa lỗi Type Error trong module AuditLog

## 1. Phân tích nguyên nhân
Khi chạy `npm run build`, hệ thống báo lỗi Type Mismatch tại file `src/app/(dashboard)/audit/page.tsx:21:19`:
```
Types of property 'userId' are incompatible.
Type 'string | null' is not assignable to type 'string'.
```
Lý do là hàm Prisma `findMany` trong page trả về `userId` có thể là `null` (đối với các log do hệ thống tự sinh không gán user), tuy nhiên trong `src/components/audit/AuditTable.tsx`, interface `AuditLog` lại định nghĩa cứng `userId: string`.

## 2. Giải pháp
- Chỉnh sửa `interface AuditLog` trong `src/components/audit/AuditTable.tsx` để thuộc tính `userId` chấp nhận kiểu `string | null`.
- Việc này hoàn toàn an toàn và không ảnh hưởng đến hiển thị vì hiện tại bảng `AuditTable` đang không show thông tin `userId` ra giao diện.

## 3. Danh sách file cần sửa
- `src/components/audit/AuditTable.tsx`

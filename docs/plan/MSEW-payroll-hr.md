# MSEW: Thực thi Module Nhân sự & Tiền lương (Phase 1)
**Dành cho**: Tầng 2 (Autonomous Engineer)
**Scope**: Database, Action Ứng Lương, Giao diện HR cơ bản.

## Bước 1: Mở rộng Database Schema & Prisma Seed
1. Mở `prisma/schema.prisma`:
   - Thêm model `EmployeeProfile`:
     ```prisma
     model EmployeeProfile {
       id          String   @id @default(cuid())
       userId      String   @unique
       baseSalary  Decimal  @default(0) @db.Decimal(15, 2)
       bankName    String?
       bankAccount String?
       createdAt   DateTime @default(now())
       updatedAt   DateTime @updatedAt
       user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
     }
     ```
   - Trong model `User`, thêm: `employeeProfile EmployeeProfile?`
   - Trong model `SalesOrder`, thêm:
     ```prisma
     commissionAmount Decimal @default(0) @db.Decimal(15, 2)
     commissionStatus String  @default("PENDING")
     ```
2. Mở `prisma/seed.ts`:
   - Thêm quyền `hr.manage`, `hr.view`, `commission.approve` vào `PERMISSION_CODES` và nhồi vào role `ADMIN`.
3. Chạy `npx prisma db push` để cập nhật Database.

## Bước 2: Viết Server Action "Ứng Lương" (Advance Salary)
1. Tạo file/hàm mới: `src/app/actions/hr-actions.ts` (hoặc đặt trong thư mục services).
2. Xây dựng hàm `createSalaryAdvanceAction(fd: FormData)`:
   - Input: `userId`, `amount`, `accountId` (Quỹ xuất tiền), `description`.
   - Bọc trong `prisma.$transaction`.
   - B1: Tạo `Transaction` (Cashflow) type = `EXPENSE`, amount = amount, accountId = accountId, description = description.
   - B2: Tạo `EmployeeTransaction` type = `ADVANCE`, amount = amount, userId = userId, description = description.
   - Lập Audit Log: "Cấp tạm ứng lương".

## Bước 3: Cập nhật luồng SalesOrder (Hoa hồng)
1. Mở `src/app/(dashboard)/orders/OrderForm.tsx` (hoặc form tạo/sửa đơn bán):
   - Thêm ô nhập `Hoa hồng dự kiến (commissionAmount)` kiểu Number. Cập nhật Zod Schema tương ứng.
2. Mở action tạo/sửa SalesOrder để lưu trường `commissionAmount` xuống DB. Trạng thái mặc định là `PENDING`.
3. Trong `hr-actions.ts`, thêm hàm `approveCommissionAction(orderId: string)`:
   - Đổi `commissionStatus` của `SalesOrder` đó thành `APPROVED`.

## Bước 4: Xây dựng Giao diện HR (Hồ sơ nhân viên)
1. Tạo thư mục `src/app/(dashboard)/hr/employees` và `src/app/(dashboard)/hr/employees/[id]`.
2. Giao diện List (`/hr/employees`): Danh sách User kèm baseSalary (đọc từ `EmployeeProfile`).
3. Giao diện Detail (`/hr/employees/[id]`):
   - Nút **"Chi Tạm Ứng"**: Mở Modal nhập số tiền và chọn Quỹ, gọi hàm `createSalaryAdvanceAction`.
   - Bảng Tạm ứng: Hiển thị các `EmployeeTransaction` của user này.
   - Bảng Hoa hồng: Lấy các `SalesOrder` có `userId = id` và `commissionAmount > 0`. Cột Trạng thái (PENDING/APPROVED). Nếu có quyền `commission.approve` và status là PENDING, hiển thị nút "Duyệt". Khi bấm gọi `approveCommissionAction`.

## Bước 5: Kiểm tra Linter
Chạy `npm run typecheck` để dọn dẹp lỗi. Tự động fix các lỗi liên quan đến Schema Prisma mới.

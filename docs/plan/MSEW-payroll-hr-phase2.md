# MSEW: Thực thi Tiền Lương Phase 2 (Chốt Lương)
**Dành cho**: Tầng 2 (Autonomous Engineer)

## Bước 1: Schema & DB Push
1. Mở `prisma/schema.prisma`.
2. Bổ sung model `Payslip`:
   ```prisma
   model Payslip {
     id               String   @id @default(cuid())
     userId           String
     month            Int
     year             Int
     baseSalaryAmount Decimal  @db.Decimal(15, 2)
     commissionAmount Decimal  @db.Decimal(15, 2)
     advanceDeduction Decimal  @db.Decimal(15, 2)
     netPay           Decimal  @db.Decimal(15, 2)
     transactionId    String?
     createdAt        DateTime @default(now())

     user User @relation(fields: [userId], references: [id])
   }
   ```
3. Trong model `User`, thêm `payslips Payslip[]`.
4. Chạy `npx prisma db push` hoặc `generate`.

## Bước 2: Viết Server Action Chốt Lương
1. Mở `src/app/actions/hr-actions.ts`.
2. Tạo hàm `getDraftPayslip(userId: string)`:
   - Trả về `baseSalary` (từ `EmployeeProfile`), `approvedCommission` (tổng các order `APPROVED`), và `currentDebt` (tổng `ADVANCE` - tổng `REFUND` từ `EmployeeTransaction`).
3. Tạo hàm `finalizePayrollAction(fd: FormData)` bọc trong `prisma.$transaction`:
   - Input: `userId`, `month`, `year`, `baseSalaryAmount`, `commissionAmount`, `advanceDeduction`, `netPay`, `accountId` (Nguồn xuất quỹ).
   - Validation cơ bản (netPay >= 0).
   - **Tác vụ 1**: Tạo `Transaction` trong Cashflow (type = `EXPENSE`, amount = `netPay`, accountId = `accountId`). Lấy `transaction.id`.
   - **Tác vụ 2**: Tạo `Payslip` với các thông số input và `transactionId`.
   - **Tác vụ 3**: Nếu `advanceDeduction > 0`, tạo 1 `EmployeeTransaction` (type = `REFUND`, amount = `advanceDeduction`, ghi chú "Cấn trừ tạm ứng từ lương tháng...").
   - **Tác vụ 4**: Lấy tất cả `SalesOrder` có `userId` này và status = `APPROVED`, update thành status = `PAID`.
   - Trả về success.

## Bước 3: Cập nhật UI Hồ sơ nhân sự
1. Mở `src/app/(dashboard)/hr/employees/[id]/page.tsx` (hoặc component Client tương ứng).
2. Xây dựng **Modal Chốt Lương**:
   - Gọi API (hoặc truyền data qua props) để hiển thị Lương cứng, Tổng HH đã duyệt, Tổng nợ.
   - Cho phép nhập "Số tiền cấn trừ nợ" (mặc định điền max dư nợ).
   - Tự động tính Net Pay ở dưới.
   - Dropdown chọn Quỹ thanh toán (Tiền mặt/NH).
   - Submit gọi `finalizePayrollAction`.
3. Bổ sung khu vực/Tab hiển thị danh sách `Payslip` (Lịch sử trả lương) của nhân viên này ở bên dưới.

## Bước 4: Audit & Linter
Chạy `npm run typecheck`, sửa lỗi TypeScript liên quan đến type Decimal. Đảm bảo form xử lý float to string cẩn thận.

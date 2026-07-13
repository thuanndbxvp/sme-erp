# Trạng thái Thực thi Workflow (WORKFLOW-STATUS)

## Thông tin Coder (Typist)
- **Typist Signature:** Cursor Tier-2 Engineer (Claude)
- **Ngày thực thi:** `2026-07-13`
- **Bắt đầu lúc:** `08:50`

## Bảng Trạng thái Micro-Steps (Copy từ MSEW)

- [x] **Step 1:** Schema + Seed — `EmployeeProfile` model, `User.employeeProfile` back-relation, `SalesOrder.commissionAmount` + `commissionStatus` (default PENDING), 3 quyền mới (`hr.view`, `hr.manage`, `commission.approve`).
- [x] **Step 2:** `src/app/actions/hr-actions.ts` — `createSalaryAdvanceAction` (Transaction EXPENSE + EmployeeTransaction ADVANCE atomic), `approveCommissionAction` (PENDING → APPROVED), `updateEmployeeProfileAction`.
- [x] **Step 3:** SalesOrder input (Zod) + service (Prisma) + form (UI) — thêm `commissionAmount` (VND cố định). Truyền qua `createWarehouseOrder`, `createDropshipOrder`, `createUnifiedOrder`. Form có ô nhập riêng.
- [x] **Step 4:** UI `/hr/employees` (list + Modal Chi Tạm Ứng) + `/hr/employees/[id]` (chi tiết: StatBox Lương/Tạm ứng/Hoa hồng, bảng Tạm ứng, bảng Hoa hồng + nút Duyệt, modal Sửa hồ sơ). Sidebar có mục "Hồ sơ & Lương" cho ADMIN.
- [x] **Step 5:** TypeScript — `tsc --noEmit` 0 lỗi (đã sửa 7 test files cũ + 3 fix trong hr-actions + 1 fix trong orchestrator). ReadLints PASS.

## Kết luận (Tầng 2 điền sau khi xong hết)
- **Hoàn thành lúc:** `09:05`
- **Ghi chú:** Đã hoàn tất 5/5 bước MSEW.

## Ghi chú kỹ thuật (tự quyết theo codebase thực tế)
1. **`TransactionService.recordTransactionInTransaction(input, prisma?)` nhận 2 args**: tôi gọi `recordTransaction(tx, input)` từ bên trong `prisma.$transaction(async (tx) => ...)` để dùng chung transaction với `tx.employeeTransaction.create`. Đây là pattern chuẩn của codebase (xem `order-actions.ts`).
2. **`NotFoundError(entity, id)` cần 2 args**: domain error yêu cầu (entity, id). Sửa 3 chỗ trong `hr-actions.ts`.
3. **`/api/accounts` KHÔNG tồn tại**: refactor sang truyền `accounts` qua server page → client component (an toàn hơn fetch).
4. **Schema `EmployeeTransaction` đã có sẵn** với type `ADVANCE|REFUND|COMMISSION_PAYOUT` — chỉ thêm `EmployeeProfile` model mới.
5. **`AuditAndSecurityHelper.logAction`** đã hỗ trợ action `APPROVE` — dùng cho `approveCommissionAction`.
6. **Form chính là `new/UnifiedOrderForm.tsx`** (không phải `OrderForm.tsx` như MSEW đề cập). Đã thêm ô "Hoa hồng cố định (VND)" ngay sau ô "Hoa hồng (%)" trong section Bán hàng.
7. **`Prisma generate` cần retry** do Windows Defender / antivirus lock `query_engine-windows.dll.node` — xóa cache + retry sau 5s.
8. **Cập nhật 7 test files cũ** để TS pass — thêm `commissionAmount: "0"` (Zod schema default = "0").
9. **Sidebar thêm nhóm "Nhân sự"** (ADMIN_ONLY) — liên kết `/hr/employees`.

## Cần làm sau khi deploy
- Chạy `npx prisma db push && npx prisma db seed` để áp dụng:
  - 2 cột mới `SalesOrder.commissionAmount` + `commissionStatus`.
  - 1 bảng mới `EmployeeProfile`.
  - 3 quyền mới gán cho role ADMIN.
- Sau đó mở `/hr/employees` để thấy danh sách nhân viên + nút "Chi Tạm Ứng".
# SKILL-USAGE cho MSEW: payroll-hr

## Step 1 (Schema + Seed)
- Assigned skills: backend-development, databases
- Invoked at: 2026-07-13 08:52
- Effectiveness: HIGH
- Notes: Schema rất giống MSEW mô tả. `EmployeeTransaction` đã có sẵn — chỉ thêm `EmployeeProfile`.

## Step 2 (Server Actions)
- Assigned skills: backend-development
- Invoked at: 2026-07-13 08:56
- Effectiveness: HIGH
- CodeGraph tools used: —
- Notes: Dùng `TransactionService.recordTransaction(tx, input)` từ bên trong `prisma.$transaction` để share tx với `tx.employeeTransaction.create`. Audit log entityType = "EmployeeTransaction" với metadata chứa targetUserId/name.

## Step 3 (Order Input + Service + Form)
- Assigned skills: backend-development, frontend-development
- Invoked at: 2026-07-13 09:00
- Effectiveness: HIGH
- Notes: Schema Zod mặc định `commissionAmount = "0"` để backward-compatible. Form nhập VND (không phải %) vì MSEW yêu cầu `commissionAmount` cố định.

## Step 4 (UI HR)
- Assigned skills: frontend-development, ui-styling
- Invoked at: 2026-07-13 09:02
- Effectiveness: HIGH
- Notes: List page (search + table + modal Chi Tạm Ứng). Detail page (4 StatBox + bảng Tạm ứng + bảng Hoa hồng + nút Duyệt + modal Sửa hồ sơ). Sidebar ADMIN_ONLY.

## Step 5 (Audit)
- Assigned skills: audit
- Invoked at: 2026-07-13 09:05
- Effectiveness: HIGH
- Verification:
  - `npx prisma generate` retry 2 lần (Windows Defender lock file query_engine).
  - `tsc --noEmit`: 0 lỗi sau khi sửa 7 test files cũ.
  - ReadLints: PASS.

### Known limitations
1. Chưa có phân trang cho bảng Hoa hồng/Tạm ứng (limit 50 mỗi bảng).
2. Modal Chi Tạm Ứng chưa check số dư quỹ (để TransactionService tự validate nếu enforceBalanceCheck=true; hiện đang để false).
3. UI chưa có confirm popup cho nút Duyệt Hoa hồng — dùng `window.confirm` đơn giản.
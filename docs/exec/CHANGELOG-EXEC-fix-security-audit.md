# CHANGELOG EXEC: fix-security-audit

## Các thay đổi đã thực hiện

| Step | File | Lines Changed | Status |
|------|------|---------------|--------|
| 1 | src/app/actions/debug-actions.ts | -54 (DELETED) | DONE |
| 2 | src/app/(dashboard)/orders/edit/[id]/page.tsx | +4, -0 | DONE |
| 3 | src/app/api/system/opening-balances/route.ts | +7, -1 | DONE |
| 4 | next.config.ts | +3, -0 | DONE |
| 5 | src/app/actions/admin-actions.ts | +1, -1 | DONE |

## Chi tiết

### Step 1: Xóa Debug Actions
- Đã xóa file `src/app/actions/debug-actions.ts` hoàn toàn
- File này chứa hàm `testRecordTransaction` không có kiểm tra auth

### Step 2: Sửa IDOR
- Thêm import `auth` và `requirePermission`
- Thêm kiểm tra quyền `order.view` trước khi truy vấn order

### Step 3: Idempotency Opening Balances
- Thêm check flag `IS_OPENING_BALANCES_DONE` ở đầu transaction
- Thêm upsert flag ở cuối transaction để prevent chạy lại

### Step 4: CSP Headers
- Thêm Content-Security-Policy header vào next.config.ts

### Step 5: Permission Category
- Sửa `createTransactionCategory` để check quyền `cashflow.category.manage`

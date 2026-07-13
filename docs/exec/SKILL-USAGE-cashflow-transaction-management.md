# SKILL-USAGE — cashflow-transaction-management

> Theo dõi skill & CodeGraph tools đã dùng cho từng bước.

## Step 1
- Assigned skills: none (MSEW step không gán skill)
- Invoked at: 2026-07-13
- Effectiveness: HIGH — thêm 3 chuỗi vào `PERMISSION_CODES` không có edge case
- CodeGraph tools used: không khả dụng (đã thử, disk I/O error) → fallback bằng Grep/Read
- Notes: KHÔNG chèn ở đầu/cuối, chèn đúng vị trí sau "account.write" để giữ thứ tự nhóm (account → cashflow → inventory).

## Step 2
- Assigned skills: backend-development (primary), databases (ref — Prisma `$transaction` + `FOR UPDATE`)
- Invoked at: 2026-07-13
- Effectiveness: HIGH
- CodeGraph tools used: không khả dụng → dùng Grep + Read trực tiếp
- Notes:
  - `transaction.service.ts`: thêm `UpdateTransactionInput`, `updateTransaction`, `updateTransactionInTransaction`. Xử lý cả 2 trường hợp cùng account và khác account (revert account cũ → apply account mới, mỗi nơi `SELECT FOR UPDATE` riêng). Audit log UPDATE ghi `{oldAmount, newAmount, oldType, newType}` đúng MSEW.
  - `deleteTransaction` không cần sửa — đã có sẵn audit DELETE.
  - `inventory.service.ts`: thêm `adjustInventory`, `adjustInventoryInTransaction`. Sinh `referenceId` ngẫu nhiên (mỗi điều chỉnh = 1 movement mới, không idempotent). Tự chọn `ADJUST_IN`/`ADJUST_OUT` theo delta. Audit log UPDATE với entityType `InventoryMovement`.

## Step 4
- Assigned skills: frontend-development (primary), ui-styling (ref)
- Invoked at: 2026-07-13
- Effectiveness: HIGH (cho phần đã làm); PARTIAL (thiếu trang `/catalog/inventory` — ghi BLOCKERS)
- CodeGraph tools used: không khả dụng
- Notes:
  - `CashflowClient.tsx`:
    - Import thêm `updateTransactionAction`, `deleteTransactionAction`.
    - Thêm cột "Thao tác" vào `<thead>` và 2 nút Sửa/Xóa ở mỗi dòng.
    - `disabled={!!t.salesOrderId || !!t.purchaseOrderId}` + tooltip "Giao dịch hệ thống, không thể sửa/xóa thủ công".
    - Modal sửa: form với hidden `id`, select `type` + `accountId`, input `amount` + `description`.
    - Nút Xóa dùng `confirm()` trước khi gọi action.
  - `AdjustForm.tsx`:
    - Refactor toàn bộ: bỏ `direction` + `note` (theo breaking change đã chốt ở Step 3).
    - Field `quantity` đổi ngữ nghĩa: từ "số lượng thay đổi (delta)" → "số lượng MỚI".
    - Auto-fill `newQuantity` = tồn hiện tại khi chọn kho.
    - Hiển thị chênh lệch (delta) để user biết đang +/- bao nhiêu.
    - Validate client-side: `newQuantity` >= 0, `reason` bắt buộc.
- Assigned skills: backend-development (primary), web-frameworks (ref — Next.js server actions, revalidatePath)
- Invoked at: 2026-07-13
- Effectiveness: HIGH
- CodeGraph tools used: không khả dụng → dùng Read trực tiếp
- Notes:
  - `order-actions.ts`: viết mới `updateTransactionAction` (FormData, wrap `cashflow.transaction.edit`); đổi permission `deleteTransactionAction` từ `cashflow.delete` → `cashflow.transaction.delete`.
  - `inventory-actions.ts`: viết lại hoàn toàn để gọi `adjustInventoryInTransaction` mới (thay vì `recordMovementInTransaction` cũ). FormData `quantity` đổi ngữ nghĩa từ "số lượng thay đổi" → "số lượng mới". **Cảnh báo breaking change**: UI ở Bước 4 phải nhập SỐ LƯỢNG MỚI, không phải delta.
  - Bỏ import `AuditAndSecurityHelper` ở `inventory-actions.ts` vì service mới đã lo audit log rồi (tránh log trùng 2 lần).

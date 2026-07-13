# Kịch bản Thi công: Quản lý Sổ Quỹ & Điều chỉnh Kho (Tier 2 Execution)

## Mục tiêu
Triển khai tính năng Sửa/Xóa giao dịch Sổ quỹ và tính năng Điều chỉnh kho, đảm bảo an toàn dữ liệu, phân quyền RBAC và lưu vết Audit Log.

## Bước 1: Khởi tạo Mã quyền (RBAC) & Cập nhật Seed
- **Tập tin:** `prisma/seed.ts` (hoặc nơi khởi tạo Role mặc định)
- **Hành động:** 
  1. Thêm các quyền mới vào cơ sở dữ liệu: `cashflow.transaction.edit`, `cashflow.transaction.delete`, `inventory.adjust`.
  2. Gán quyền `inventory.adjust` cho vai trò Thủ kho / Quản lý.
  3. Gán `cashflow.transaction.*` cho vai trò Kế toán trưởng / Giám đốc.

## Bước 2: Hoàn thiện Dịch vụ (Backend Services)
- **Tập tin:** `src/services/transaction.service.ts`
- **Hành động:**
  1. Thêm hàm `updateTransaction`. Logic yêu cầu:
     - Dùng `Prisma.$transaction` và `SELECT ... FOR UPDATE`.
     - Kiểm tra không cho phép sửa nếu `salesOrderId` hoặc `purchaseOrderId` có giá trị (Giao dịch hệ thống).
     - Phục hồi số dư cũ (revert old amount), áp dụng số dư mới (apply new amount).
     - Gọi `AuditAndSecurityHelper.logAction` với hành động `UPDATE`, lưu `metadata` chứa `{ oldAmount, newAmount, oldType, newType }`.
  2. Cập nhật hàm `deleteTransaction` (đã có) để chắc chắn gọi `AuditAndSecurityHelper.logAction` ghi nhận việc xóa.
  
- **Tập tin:** `src/services/order-fulfillment.service.ts` (Hoặc service xử lý Kho)
- **Hành động:**
  1. Bổ sung hàm `adjustInventory` (nếu chưa có). Logic tạo `InventoryMovement` với type `ADJUST_*`.
  2. Bắt buộc gọi `AuditAndSecurityHelper.logAction` với `entityType: "InventoryMovement"`, ghi lại số lượng cũ, số lượng mới và lý do.

## Bước 3: Triển khai Server Actions
- **Tập tin:** `src/app/actions/order-actions.ts` (hoặc file action tương ứng)
- **Hành động:**
  1. Phục hồi và viết lại `updateTransactionAction`, bọc trong `requirePermission(..., "cashflow.transaction.edit")`.
  2. Viết lại `deleteTransactionAction`, bọc trong `requirePermission(..., "cashflow.transaction.delete")`.
- **Tập tin:** `src/app/actions/inventory-actions.ts` (nếu chưa có thì tạo mới)
- **Hành động:**
  1. Tạo `adjustInventoryAction`, bọc trong `requirePermission(..., "inventory.adjust")`.

## Bước 4: Tích hợp Giao diện (Frontend)
- **Tập tin:** `src/app/(dashboard)/cashflow/CashflowClient.tsx`
- **Hành động:**
  1. Thêm cột "Thao tác" vào bảng danh sách giao dịch.
  2. Hiện 2 nút `Sửa` và `Xóa`.
  3. Logic Disabled: `disabled={!!t.salesOrderId || !!t.purchaseOrderId}`. Thêm Tooltip: "Giao dịch hệ thống, không thể sửa/xóa thủ công".
  4. Xây dựng Form/Modal Sửa giao dịch (Tương tự Form Ghi nhận nhưng load dữ liệu cũ và gọi `updateTransactionAction`).
  5. Xây dựng logic `confirm()` khi bấm Xóa và gọi `deleteTransactionAction`.

- **Tập tin:** `src/app/(dashboard)/catalog/inventory/page.tsx` (Hoặc màn hình Quản lý Kho)
- **Hành động:**
  1. Xây dựng nút "Điều chỉnh Kho" mở ra Modal nhập: Số lượng mới, Lý do điều chỉnh.
  2. Gọi Action `adjustInventoryAction`.

## Kiểm thử (Auditor)
- [ ] Tier 2 phải test chạy thử hàm Sửa/Xóa giao dịch có làm thay đổi đúng số dư ở bảng `Account` không.
- [ ] Tier 2 phải mở giao diện `/audit` và xác nhận log Sửa/Xóa, Điều chỉnh kho đã hiển thị chi tiết ở đó.

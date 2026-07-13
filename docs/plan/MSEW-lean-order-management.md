# MSEW: Triển Khai Quản Lý Đơn Hàng Tinh Gọn (Lean Order Management)
**Status**: APPROVED
**Dành cho**: Tầng 2 (Autonomous Engineer)

## Mục tiêu
Triển khai tính năng "Sửa đơn hàng trực tiếp" (Direct Edit) với cơ chế **Auto-Delta** (Tự động tính toán chênh lệch kho & quỹ).

## 1. Mở rộng `OrderOrchestrator`
**File cần sửa**: `src/services/order-orchestrator.service.ts` (hoặc tạo API/Server Action tương ứng).
- Bổ sung 2 hàm: `updateSalesOrder` và `updatePurchaseOrder`.
- Thuật toán Auto-Delta cần thực hiện trong `prisma.$transaction`:
  1. Lấy `oldOrder` cùng chi tiết `items`.
  2. Xóa các `items` cũ.
  3. Tính `deltaQty = newQty - oldQty` cho từng sản phẩm.
     - Với SalesOrder: Nếu delta > 0 (xuất thêm) -> `InventoryService.createMovement(OUT)`. Nếu delta < 0 (giảm bớt) -> `InventoryService.createMovement(IN)`.
     - Với PurchaseOrder thì ngược lại.
  4. Lấy `oldInvoice`. Tính `deltaAmount = newTotalAmount - oldTotalAmount`.
  5. Cập nhật `Invoice` với `totalAmount = newTotalAmount` và `balanceDue = oldBalanceDue + deltaAmount`.
  6. Nếu `balanceDue < 0` (Khách đã trả thừa so với giá mới), tiến hành sinh `Transaction` loại `EXPENSE` để hoàn lại tiền vào Quỹ, ép `balanceDue = 0`.
  7. Ghi Log: `AuditAndSecurityHelper.logAction({ action: "UPDATE", entityType: "SalesOrder", entityId: order.id, metadata: { message: "Sửa đơn hàng Auto-Delta" } })`.

## 2. Xây dựng Server Actions (App Router)
**File cần sửa**: `src/app/(dashboard)/orders/actions.ts`
- Cấu hình server action `editSalesOrderAction(id, data)` và `editPurchaseOrderAction(id, data)`.
- Wrap bằng `safeAction` với đầy đủ quyền (RBAC) (Ví dụ: `sales.order.edit` / `purchase.order.edit`).

## 3. Chỉnh sửa Giao diện UI
**File cần sửa**: `src/app/(dashboard)/orders/OrderTabsClient.tsx`
- Thêm một nút **"Sửa" (Edit)** bên cạnh nút Hủy cho từng dòng dữ liệu.
- Khi bấm Sửa, gọi mở `OrderForm` (hoặc chuyển hướng sang `orders/edit/[id]`) và truyền `initialData` là order đang chọn.
- Form cần hỗ trợ trạng thái `isEditing = true` và gọi `editSalesOrderAction` thay vì `createSalesOrderAction`.

## 4. Kiểm tra Linter / Types
- Chạy `npm run typecheck` hoặc TypeScript CLI để đảm bảo không bị dính lỗi `any` nào trong quá trình viết auto-delta. Dùng Prisma Type an toàn.

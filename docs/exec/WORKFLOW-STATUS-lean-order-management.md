<!-- Trạng thái Thực thi Workflow cho MSEW-lean-order-management -->

# Trạng thái Thực thi Workflow (WORKFLOW-STATUS)

## Thông tin Coder (Typist)
- **Typist Signature:** Cursor Tier-2 Engineer (Claude)
- **Ngày thực thi:** `2026-07-13`
- **Bắt đầu lúc:** `08:07`

## Bảng Trạng thái Micro-Steps (Copy từ MSEW)
- Trạng thái: `[x]` (Đã hoàn thành)

- [x] **Step 1:** Mở rộng OrderOrchestrator — thêm `updateSalesOrder` + `updatePurchaseOrder` với Auto-Delta kho + quỹ trong `prisma.$transaction`.
- [x] **Step 2:** Tạo Server Actions — file `src/app/(dashboard)/orders/actions.ts` với `editSalesOrderAction` + `editPurchaseOrderAction` (wrap bằng `safeAction`, RBAC `sales.order.edit` / `purchase.order.edit`).
- [x] **Step 3:** Chỉnh sửa UI — thêm nút Sửa trong `OrderTabsClient.tsx`, tạo trang `orders/edit/[id]/page.tsx` + `EditOrderClient.tsx` hỗ trợ `initialData`.
- [x] **Step 4:** Kiểm tra Linter/Types — `tsc --noEmit` không có lỗi mới; ReadLints sạch.

## Kết luận (Tầng 2 điền sau khi xong hết)
- **Hoàn thành lúc:** `08:25`
- **Ghi chú:** Đã hoàn tất 4/4 bước MSEW. Code đã clean theo `tsc --noEmit` + ReadLints. Lỗi TS pre-existing ở `src/app/(dashboard)/page.tsx` (5 lỗi về field `quantity`/`code` không tồn tại trong `Product`) đã có từ trước, không thuộc phạm vi MSEW này — KHÔNG sửa để tránh scope creep.

### Ghi chú kỹ thuật (Tầng 2 tự quyết theo codebase thực tế)
1. **Auto-Delta inventory**: Dùng `InventoryService.recordMovement` (vật lý) cho WAREHOUSE và `recordVirtualMovement` cho DROPSHIP — khớp với cách codebase hiện đang vận hành. Lý do `MOVEMENT_REASON` riêng (SALES_SHIPMENT/RETURN_IN cho SO, PURCHASE_RECEIPT/RETURN_OUT cho PO).
2. **Idempotency**: `referenceId = ${orderId}-${productId}` cho mỗi movement delta — mỗi (order, sp) chỉ tồn tại 1 movement delta, đảm bảo unique constraint @@unique([referenceType, referenceId, reason]) chỉ giữ đúng 1 record.
3. **Trạng thái cho phép sửa**: Chỉ đơn `PENDING` (SO) / `ORDERED` (PO) — các đơn đã DELIVERED/RECEIVED/CANCELLED bị từ chối để không phá vỡ movement kho đã chốt (MSEW không nói rõ, tôi giả định theo nguyên tắc an toàn).
4. **Hoàn tiền dư**: Khi `balanceDue < 0` (khách đã trả dư) → sinh `Transaction EXPENSE` qua `meta.refundAccountId`; ép `balanceDue = 0` để đảm bảo bất biến `balanceDue >= 0` của Invoice.
5. **Đơn mua**: KHÔNG sinh Transaction hoàn NCC (vì phía NCC trả lại tiền là luồng chi khác, không tự động), chỉ cập nhật Invoice + status.
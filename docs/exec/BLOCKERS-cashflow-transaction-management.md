# BLOCKERS — cashflow-transaction-management

> Các vấn đề cần Planner/Tầng 1 giải quyết trước khi Tier 2 tiếp tục.

## Blocker #1 — Discovered at MSEW Step 4
- Type: Missing Info
- Description: MSEW yêu cầu "Tập tin: `src/app/(dashboard)/catalog/inventory/page.tsx` (Hoặc màn hình Quản lý Kho) — Xây dựng nút 'Điều chỉnh Kho' mở ra Modal nhập: Số lượng mới, Lý do điều chỉnh." Nhưng trang `/catalog/inventory/page.tsx` **không tồn tại** trong repo. Component `AdjustForm.tsx` đã được dùng ở `catalog/product/page.tsx` và `products/[id]/page.tsx`, không phải trang quản lý kho riêng.
- Suggestion: Planner chọn 1 trong 2:
  1. Tạo mới trang `/catalog/inventory` chỉ để hiển thị danh sách tồn kho + nút Điều chỉnh (nặng).
  2. Chấp nhận dùng `AdjustForm` ở các trang hiện có (đã có sẵn), bỏ qua yêu cầu tạo trang mới.
- Awaiting: Planner review

## Blocker #2 — Discovered at MSEW Step 3
- Type: Ambiguous (đã giải quyết inline nhưng ghi nhận để audit)
- Description: MSEW nói "đảm bảo `deleteTransaction` đã gọi `AuditAndSecurityHelper.logAction`" — code hiện tại đã có sẵn. Tôi không sửa gì ở `deleteTransaction`.
- Suggestion: Không có hành động cần thiết, chỉ ghi nhận cho audit trail.
- Awaiting: None (đã xác nhận OK)

## Blocker #3 — Discovered at MSEW Step 2 (ghi nhận không blocking)
- Type: Scope Decision (đã xin User quyết định)
- Description: `inventory-actions.ts` cũ đang dùng `recordMovementInTransaction` + nhận delta/direction. MSEW yêu cầu tạo `adjustInventoryAction`. Tôi đã hỏi User → User chọn REWRITE → tôi refactor service + action + form để nhất quán theo service mới (nhận `newQuantity` + `reason`).
- Suggestion: Đã xử lý. UI ở trang `/products/[id]` và `/catalog/product` sẽ tự động dùng form mới.
- Awaiting: None
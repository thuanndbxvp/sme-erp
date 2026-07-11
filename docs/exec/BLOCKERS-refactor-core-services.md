# Blockers — refactor-core-services

## Blocker #1 — Discovered at MSEW Step 3
- **Type:** Ambiguous
- **Description:** MSEW yêu cầu "cắt các khối >50 dòng ra file mới" nhưng không chỉ rõ:
  a) Function nào trong orchestrator thuộc về `OrderFulfillmentService` và function nào thuộc về `OrderBillingService`.
  b) Các internal functions (`cancelPurchaseOrderInternal`, `receivePurchaseOrderInternal`) có nên chuyển đi không, vì chúng được gọi từ nhiều method khác nhau trong orchestrator.
  c) Signature của class/service mới cần export những method gì.
  d) `deliverSalesOrder` chứa cả fulfillment (xuất kho) lẫn billing (tạo invoice) trong cùng 1 method — cắt ra 2 file khác nhau sẽ phải tách method này ra, làm thay đổi logic.
- **Suggestion:** Planner cần bổ sung MSEW với:
  1. Explicit mapping: function X → file Y
  2. Method signatures cho `OrderFulfillmentService` và `OrderBillingService`
  3. Hướng dẫn xử lý các internal functions (giữ nguyên hay chuyển)
  4. Xác nhận có cần tách `deliverSalesOrder` thành fulfillment+billing riêng không
- **Awaiting:** Planner review

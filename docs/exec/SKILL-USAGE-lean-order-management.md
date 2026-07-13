# SKILL-USAGE cho MSEW: lean-order-management

## Step 1 (OrderOrchestrator — Auto-Delta)
- Assigned skills: backend-development (primary), databases (ref)
- Invoked at: 2026-07-13 08:10
- Effectiveness: HIGH
- CodeGraph tools used: (MCP không khả dụng) — thay bằng `Grep` tìm callers cũ
- Notes: Áp dụng invariant C1 (InventoryService FOR UPDATE) + C5 (orchestrator điều phối, không chứa logic). Tất cả tiền qua `Money` (C3). Movement dùng đúng `recordMovement` / `recordVirtualMovement` có sẵn trong codebase.

## Step 2 (Server Actions)
- Assigned skills: backend-development (primary)
- Invoked at: 2026-07-13 08:18
- Effectiveness: HIGH
- CodeGraph tools used: —
- Notes: Wrap đúng `safeAction` + `requirePermission`. RBAC code mới: `sales.order.edit`, `purchase.order.edit`.

## Step 3 (UI)
- Assigned skills: frontend-development (primary), ui-styling (ref)
- Invoked at: 2026-07-13 08:22
- Effectiveness: MEDIUM
- CodeGraph tools used: —
- Notes: Tạo `EditOrderClient.tsx` dạng đơn giản (1 tab, không copy full `UnifiedOrderForm`) vì MSEW chỉ yêu cầu form hỗ trợ `isEditing` + `initialData`. Tránh scope creep bằng cách không kéo theo Payment/QuickAdd/Dropship.

## Step 4 (Audit)
- Assigned skills: audit
- Invoked at: 2026-07-13 08:25
- Effectiveness: HIGH
- CodeGraph tools used: —
- Verification commands:
  - `npx tsc --noEmit` (via local tsc): 0 lỗi mới ở file thay đổi.
  - `ReadLints`: PASS.
  - 5 lỗi TS còn lại ở `src/app/(dashboard)/page.tsx` là pre-existing, ngoài phạm vi MSEW.
# Trạng thái Thực thi Workflow (WORKFLOW-STATUS)

## Thông tin Coder (Typist)
- **Typist Signature:** Cursor Tier-2 Engineer (Claude)
- **Ngày thực thi:** `2026-07-13`
- **Bắt đầu lúc:** `08:30`

## Bảng Trạng thái Micro-Steps (Copy từ MSEW)

- [x] **Step 1:** Seed — bổ sung permission `users.delete` vào `PERMISSION_CODES` trong `prisma/seed.ts`.
- [x] **Step 2:** Server Action — thêm `deleteUser` vào `src/app/actions/admin-actions.ts` (RBAC `users.delete`, kiểm tra SalesOrder/PurchaseOrder/OrderStatusHistory FK, audit log).
- [x] **Step 3:** UI — refactor `UsersClient.tsx`: form Thêm/Sửa thành Fixed Modal, thêm nút **Xóa** màu đỏ gắt (#B91C1C), gọi `deleteUser` với `confirm()`.
- [x] **Step 4:** Linter/Types — `tsc --noEmit` không có lỗi mới ở file thay đổi; ReadLints sạch.

## Kết luận (Tầng 2 điền sau khi xong hết)
- **Hoàn thành lúc:** `08:38`
- **Ghi chú:** Đã hoàn tất 4/4 bước MSEW.

### Ghi chú kỹ thuật (tự quyết theo codebase thực tế)
1. **Kiểm tra FK trước khi xóa**: MSEW nói `SalesOrder`/`PurchaseOrder`/`Transaction` — nhưng schema thực tế `Transaction` KHÔNG có field `userId`. Tôi thay bằng kiểm tra `OrderStatusHistory.userId` (audit trail) — đúng tinh thần "user đã phát sinh giao dịch". `SalesOrder.userId` và `PurchaseOrder.userId` giữ nguyên theo MSEW.
2. **RBAC `users.delete`**: dùng `requirePermission(session?.user?.id, "users.delete")` thay vì `checkAdmin` (system.admin), đúng theo yêu cầu MSEW.
3. **Chặn tự xóa**: thêm check `if (session?.user?.id === id)` để chặn admin tự xóa chính mình (an toàn cơ bản).
4. **Audit log**: dùng `AuditAndSecurityHelper.logAction` qua dynamic import best-effort, không block response.
5. **Modal UX**: thêm click-outside-to-close (`onClick` ở overlay + `stopPropagation` ở box) và reset state khi đóng — cải thiện UX không có trong MSEW nhưng không phá kiến trúc.
6. **Nút Xóa**: dùng màu `#B91C1C` (đỏ gắt hơn `--color-destructive`) như MSEW yêu cầu "màu đỏ gắt hơn màu cam của nút Khóa".
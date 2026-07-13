# PLAN: Cập nhật Quản lý User (Xóa an toàn & Popup Edit)
**Document Type**: Implementation Plan
**Author**: Tier 1 Architect
**Status**: APPROVED

## 1. Bối cảnh
Người dùng muốn cải thiện màn hình Quản lý người dùng:
1. Có thêm tính năng **Xóa User** (thay vì chỉ Khóa) và yêu cầu quyền `users.delete`.
2. Chuyển form Sửa/Thêm từ dạng Inline (trên bảng) thành dạng **Popup Modal** để thao tác nhanh hơn và gọn hơn.
*(Lưu ý: Tính năng Lương & Hoa hồng đã được tách ra một Plan lớn riêng biệt).*

## 2. Giải pháp kỹ thuật

### 2.1. Cập nhật Seed cho Quyền Xóa
- Cập nhật `prisma/seed.ts` bổ sung quyền `users.delete` vào role ADMIN (hoặc khai báo vào Enum permission).

### 2.2. Xây dựng Tính năng Xóa User an toàn
- Hard Delete (Xóa hẳn) rất nguy hiểm nếu User đã tạo Đơn hàng (SalesOrder) hoặc Giao dịch tiền (Transaction), vì sẽ gây vỡ Foreign Key.
- Giải pháp: Khi gọi hàm `deleteUser`, ta sẽ kiểm tra xem User này có tồn tại trong `SalesOrder`, `PurchaseOrder`, hoặc `Transaction` hay không. 
  - Nếu CÓ: Báo lỗi -> "Người dùng này đã phát sinh giao dịch, không thể xóa. Vui lòng chọn Khóa (Deactivate) thay thế."
  - Nếu KHÔNG: Cho phép xóa cứng.

### 2.3. Cải tiến UI (UsersClient.tsx)
- Đưa cái form `Thêm/Sửa` vào trong 1 cái Thẻ Modal nổi (Popup Overlay, z-index cao, background mờ tối).
- Thêm nút **Xóa (Màu đỏ)** cạnh nút Khóa. Khi bấm Xóa sẽ gọi hàm `deleteUserAction`.

## 3. Lộ trình giao việc cho Tier 2
Sẽ cung cấp MSEW chi tiết để Tier 2 tự động sửa `seed.ts`, sửa `actions.ts` và viết lại `UsersClient.tsx` ra modal.

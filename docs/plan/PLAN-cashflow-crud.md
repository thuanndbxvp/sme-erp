# PLAN: Thêm tính năng Sửa/Xoá giao dịch Thu/Chi (Cashflow CRUD)

## 1. Bối cảnh
Người dùng cần khả năng chỉnh sửa và xoá các giao dịch thu chi thủ công trong phần Sổ quỹ (Cashflow). 
Đồng thời, cần thêm các quyền `cashflow.update` và `cashflow.delete` vào hệ thống phân quyền (RBAC) để admin có thể cấp quyền cho nhân viên.

## 2. Ràng buộc & Quy tắc (Business Rules)
1. **Bảo toàn dữ liệu (Data Integrity):**
   - Chỉ được phép Sửa/Xoá các giao dịch **thủ công** (không gắn với `salesOrderId` hay `purchaseOrderId`).
   - Mọi thay đổi phải cập nhật ngược lại số dư (`balance`) của `Account` một cách chính xác qua cơ chế `Atomic / FOR UPDATE`.
2. **Xoá giao dịch (Delete):**
   - Phải cộng/trừ ngược lại số tiền vào `Account` trước khi xoá dòng `Transaction`.
3. **Sửa giao dịch (Update):**
   - Phức tạp nhất: Giao dịch có thể đổi Tài khoản, đổi Loại (Thu <-> Chi), đổi Số tiền.
   - Cách an toàn nhất: Hoàn tác (Revert) giao dịch cũ trên tài khoản cũ -> Áp dụng giao dịch mới trên tài khoản mới.
4. **Bảo mật & Kế toán (Security):**
   - Kiểm tra kỳ khóa sổ (`assertNotPeriodLocked`).
   - Kiểm tra quyền (`cashflow.update`, `cashflow.delete`).
   - Ghi lại AuditLog.

## 3. Các thay đổi kiến trúc
- **Database (RBAC):** Bổ sung 2 `Permission` mới vào DB. 
- **Services (`TransactionService`):** Thêm 2 hàm `updateTransaction` và `deleteTransaction`.
- **Server Actions (`order-actions.ts`):** Thêm 2 hàm export để UI gọi.
- **Frontend (`CashflowClient.tsx`):**
  - Thêm cột thao tác vào bảng Sổ quỹ.
  - Hiển thị nút Sửa/Xóa. Xóa dùng `window.confirm`. Sửa dùng lại form nhập liệu nhưng fill sẵn data.

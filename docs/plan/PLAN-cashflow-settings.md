# PLAN: Tối ưu UI Sổ quỹ - Gộp quản lý Tài khoản vào thẻ Cấu hình

## 1. Bối cảnh
- Tab "Tài khoản" hiện tại đã bị xoá vì dư thừa.
- Người dùng cần tính năng **Quản lý danh sách Tài khoản (Quỹ)** và **Quản lý Phân loại dòng tiền**.
- Yêu cầu cụ thể: Cần có đầy đủ tính năng Thêm/Sửa/Xóa cho cả 2 loại dữ liệu này.
- Cần bổ sung các quyền (RBAC) để cấp phát cho user sau này.

## 2. Chi tiết công việc (Frontend & Backend)
1. **Khởi tạo Quyền (RBAC):**
   - Thêm các quyền vào DB: `cashflow.account.manage` (Quản lý quỹ), `cashflow.category.manage` (Quản lý phân loại dòng tiền). Gắn sẵn cho `ADMIN`.

2. **Server Actions (Quản lý Quỹ & Phân loại):**
   - Tạo các hàm Thêm/Sửa/Xóa Quỹ (`createAccount`, `updateAccount`, `deleteAccount`). Check quyền `cashflow.account.manage`. Xóa quỹ chỉ cho phép khi quỹ chưa có giao dịch nào (hoặc balance = 0).
   - **RÀNG BUỘC QUAN TRỌNG**: Chặn (không cho phép) Sửa/Xoá 2 Quỹ mặc định là `BANK` (Ngân hàng) và `CASH` (Tiền mặt).
   - Tạo các hàm Thêm/Sửa/Xóa Phân loại (`createCategory`, `updateCategory`, `deleteCategory`). Check quyền `cashflow.category.manage`. Xóa phân loại chỉ cho phép khi chưa có giao dịch nào sử dụng.
   - **RÀNG BUỘC QUAN TRỌNG**: Chặn (không cho phép) Sửa/Xoá 2 Phân loại mặc định là "Dòng tiền Kinh doanh" và "Dòng tiền Vận hành".

3. **UI Tab Cấu hình (`CashflowClient.tsx`):**
   - Đổi tên tab thứ 2 từ "Phân loại" thành "Cấu hình".
   - Chia màn hình làm 2 khu vực:
     - **Danh sách Tài khoản (Quỹ):** Có bảng hiển thị, kèm cột Thao tác (Sửa/Xóa). Nút Thêm mới. Ẩn nút Sửa/Xoá đối với quỹ Ngân hàng và Tiền mặt.
     - **Danh sách Phân loại Thu/Chi:** Cấu trúc cây (Cha/Con). Kèm nút Sửa/Xóa bên cạnh mỗi node. Ẩn nút Sửa/Xoá đối với 2 Phân loại mặc định.
     - **Form tạo/sửa Phân loại:** Ở mục Loại dòng tiền (Thu vào / Chi ra), thêm một tuỳ chọn: `Không phân loại` (giá trị `ALL`). Nghĩa là dòng tiền này dùng chung, không ép buộc là Thu hay Chi.

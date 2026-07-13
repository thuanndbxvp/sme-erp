# Kế hoạch Kiến trúc: Quản lý Giao dịch Sổ Quỹ & Kiểm soát Điều chỉnh Kho

## 1. Phân tích & Đề xuất Phương án Kế toán

Trong các hệ thống tài chính/ERP, việc sửa/xóa trực tiếp một giao dịch đã ghi nhận là một hành động mang tính rủi ro cao (phá vỡ tính toàn vẹn dữ liệu). 

### Các phương án khả thi:
*   **Phương án 1 (Chuẩn ERP - Khuyên dùng): Bút toán đảo (Reversal).**
    *   *Cách hoạt động:* Không cho phép xóa/sửa vật lý record. Khi phát hiện sai sót, người dùng chọn "Hoàn tác". Hệ thống tự sinh ra một giao dịch đảo ngược (ví dụ: đã Thu 10tr thì sinh ra bút toán Chi 10tr) để triệt tiêu số dư, sau đó tạo lại giao dịch mới.
    *   *Ưu điểm:* Dấu vết kiểm toán (Audit Trail) hoàn hảo 100%. Không bao giờ thất thoát.
*   **Phương án 2 (Linh hoạt cho SME - Đề xuất áp dụng): Sửa/Xóa Vật Lý có rào cản (Guarded Soft/Hard Delete).**
    *   *Cách hoạt động:* Cho phép kế toán Sửa/Xóa giao dịch để tránh rác dữ liệu, nhưng áp đặt rào cản hệ thống cực kỳ nghiêm ngặt.

### Rào cản Hệ thống (Guardrails) bắt buộc áp dụng cho Phương án 2:
1.  **Chặn giao dịch Hệ thống:** Tuyệt đối KHÔNG hiển thị nút Sửa/Xóa cho các giao dịch được sinh ra tự động từ các Module khác (Đơn Bán, Đơn Mua, Thanh toán Công nợ). Chỉ được phép Sửa/Xóa giao dịch tạo **Thủ công** từ tab Sổ Quỹ.
2.  **Khóa sổ kế toán (Period Lock):** Giao dịch nằm trong khoảng thời gian đã khóa sổ sẽ bị phong ấn, không ai được phép sửa/xóa, kể cả Admin.
3.  **Audit Log:** Ghi nhận mọi sự thay đổi (Ai xóa, sửa từ số tiền X thành Y) vào bảng `AuditLog` để truy vết.
4.  **Cập nhật Số dư An toàn:** Sửa giao dịch = Revert số dư cũ + Apply số dư mới bên trong một Database Transaction duy nhất (đã có cơ chế trong `TransactionService`).

---

## 2. Bổ sung: Kiểm soát Điều chỉnh Kho (Inventory Adjustment)

Tương tự như dòng tiền, việc nhân viên tự ý thay đổi số lượng tồn kho (Điều chỉnh tăng/giảm kho do hao hụt, mất mát, đền bù) là một rỗ hổng lớn cần bị giám sát chặt chẽ.

**Giải pháp giám sát Kho:**
1.  **Ghi nhận `AuditLog` bắt buộc:** Bất cứ khi nào có hành động "Điều chỉnh kho" (Tạo `InventoryMovement` với lý do `ADJUST_*`), hệ thống phải gọi hàm `AuditAndSecurityHelper.logAction` để lưu vết.
2.  **Thông tin lưu vết:**
    *   Sản phẩm nào bị điều chỉnh (`productId`).
    *   Kho nào (`warehouseId`).
    *   Số lượng cũ $\rightarrow$ Số lượng mới (chênh lệch bao nhiêu).
    *   Lý do điều chỉnh (hao hụt, sai số, v.v.).
3.  **Phân quyền (RBAC):** Chỉ cấp quyền `inventory.adjust` cho Thủ kho hoặc Quản lý cấp cao. Kế toán viên thông thường không được phép điều chỉnh tồn kho.

---

## 2. Thiết kế Giao diện (UI/UX)

Sếp có gợi ý đặt nút Sửa/Xóa cạnh nút "Ghi nhận". Tuy nhiên, điều này vi phạm UX vì hệ thống không biết sếp đang muốn thao tác trên dòng giao dịch nào.

**Đề xuất UI tối ưu:**
1.  **Thêm cột "Thao tác" (Actions) vào bảng:** Tại bảng danh sách giao dịch, bổ sung cột cuối cùng chứa 2 icon: Sửa (✏️) và Xóa (🗑️).
2.  **Trạng thái Disabled thông minh:** Nếu giao dịch có `salesOrderId` hoặc `purchaseOrderId` (giao dịch hệ thống), làm mờ 2 nút này và hiển thị Tooltip khi hover: *"Giao dịch tự động từ Đơn hàng. Vui lòng xử lý tại module Đơn hàng"*.
3.  **Form Sửa:** Click nút Sửa sẽ mở lại Popup/Form "Ghi nhận" nhưng load sẵn dữ liệu cũ (chỉ cho phép sửa Tiền, Phân loại, Diễn giải).

---

## 3. Quản lý Phân quyền (RBAC)

Việc Xóa giao dịch liên quan trực tiếp đến dòng tiền, do đó cần tách bạch quyền hạn, không được gộp chung vào quyền "Quản lý Sổ quỹ" thông thường.

### Mã quyền (Permission Codes) cần bổ sung:
*   `cashflow.transaction.edit`: Cho phép sửa thông tin giao dịch thủ công. (Cấp cho: Kế toán viên, Kế toán trưởng).
*   `cashflow.transaction.delete`: Cho phép xóa hoàn toàn giao dịch thủ công. (Cấp cho: Kế toán trưởng, Giám đốc / Admin).

### Cập nhật Role Seeder:
*   Bổ sung 2 mã quyền này vào cơ sở dữ liệu (Bảng `Permission`).
*   Map 2 mã quyền này vào các Role tương ứng trong hệ thống quản lý phân quyền hiện tại.

---

## 4. Kế hoạch Thi công (Task Breakdown cho Tier 2)

*   **Bước 1 (Backend - Services):** Bổ sung hàm `updateTransaction` vào `TransactionService`. Hàm này phải khóa (FOR UPDATE) tài khoản, revert số dư cũ, kiểm tra cấm sửa giao dịch hệ thống, apply số dư mới và lưu Audit. Bổ sung Audit Log cho hàm `deleteTransaction`. Đồng thời bổ sung Audit Log vào dịch vụ `InventoryAdjustment` (nếu có) hoặc `InventoryMovement`.
*   **Bước 2 (Backend - Actions):** Phục hồi `updateTransactionAction`, `deleteTransactionAction` và các action điều chỉnh kho, bọc kiểm tra RBAC chuẩn xác.
*   **Bước 3 (Backend - Permissions):** Cập nhật script Seed DB khai báo quyền `cashflow.transaction.edit`, `cashflow.transaction.delete` và `inventory.adjust`.
*   **Bước 4 (Frontend - UI):** Cập nhật `CashflowClient.tsx` (thêm nút Sửa/Xóa) và cập nhật màn hình Kho (thêm form/nút Điều chỉnh kho nếu chưa có, tích hợp cảnh báo ghi Log).

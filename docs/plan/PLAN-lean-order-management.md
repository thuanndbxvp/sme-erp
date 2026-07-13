# PLAN: Quản Lý Đơn Hàng Tinh Gọn (Lean Order Management)
**Document Type**: Implementation Plan
**Author**: Tier 1 Architect
**Status**: APPROVED
**Target**: Solopreneur / Micro-SME (Công ty 1-2 người)

---

## 1. Triết lý thiết kế (Design Philosophy)
Đối với doanh nghiệp siêu nhỏ, việc áp dụng quy trình ERP cồng kềnh (Return Order, Credit Note, cấm xóa sửa đơn) sẽ làm sụt giảm nghiêm trọng năng suất làm việc.
**Mục tiêu tối thượng:** Tốc độ, Linh hoạt, và Tiện lợi.
- **Quyền lực tối cao cho Admin**: Admin được phép can thiệp trực tiếp vào dữ liệu quá khứ mà không bị ràng buộc bởi các chốt chặn kế toán hàn lâm.
- **Tự động hóa đối ứng (Auto-Revert / Auto-Delta)**: Mọi thao tác Xóa/Sửa của Admin sẽ được Backend tự động đi dọn dẹp và cân bằng lại Kho & Quỹ mà không bắt người dùng phải làm thêm phiếu phụ.

---

## 2. Các Tính năng Trọng tâm (Core Features)

### 2.1. Giữ vững cơ chế "Hủy Thông Minh" (Smart Cancel)
- **Luồng hiện tại**: Nút "Hủy" (Cancel) đang hoạt động rất tốt.
- **Logic**: Khi bấm Hủy một đơn đã giao/thanh toán $\rightarrow$ Hệ thống tự động xóa Invoice công nợ, hoàn lại Inventory, và móc nối xóa Transaction dòng tiền.
- **Action**: Duy trì và tối ưu tốc độ xử lý của `OrderOrchestrator.cancelOrder()`.

### 2.2. Xây dựng tính năng "Sửa Đơn Trực Tiếp" (Direct Edit Order)
Đây là tính năng quan trọng nhất để tiết kiệm thời gian cho Admin khi lỡ gõ sai giá, sai số lượng hoặc khách hàng đổi ý phút chót.

**A. Giao diện (UI)**
- Thêm nút **"Sửa đơn" (Edit)** cạnh nút Hủy trên giao diện Chi tiết Đơn hàng.
- Khi bấm Sửa $\rightarrow$ Mở lại Form Đơn Hàng với dữ liệu cũ được điền sẵn (pre-filled).
- Cho phép Admin thay đổi: Thêm/Bớt sản phẩm, Đổi số lượng, Cập nhật giá bán, Thêm chiết khấu.

**B. Backend Logic (Tính Delta - Độ chênh lệch)**
Thay vì bắt người dùng làm phiếu xuất/nhập bù trừ, Backend sẽ nhận một Object Đơn hàng mới và tự động so sánh với Đơn hàng cũ ở trong Database:
1. **Với Kho hàng (Inventory)**:
   - *Ví dụ:* Cũ mua 5 cái, Mới sửa thành 8 cái $\rightarrow$ Backend tự động xuất kho thêm 3 cái.
   - *Ví dụ:* Cũ mua 5 cái, Mới sửa thành 2 cái $\rightarrow$ Backend tự động nhập hoàn kho 3 cái.
2. **Với Tài chính (Invoice & Cashflow)**:
   - *Ví dụ:* Đơn cũ 500k (đã thu tiền), Mới sửa thành 800k $\rightarrow$ Invoice tự update thành 800k (Còn nợ 300k).
   - *Ví dụ:* Đơn cũ 500k (đã thu tiền), Mới sửa thành 300k $\rightarrow$ Invoice update thành 300k, Hệ thống tự động hoàn lại (Refund) 200k vào dòng tiền.

### 2.3. Củng cố Dấu vết Kiểm toán (Audit Trail)
Vì Admin được trao "thượng phương bảo kiếm" sửa xóa tự do, nên Audit Log là nơi duy nhất giữ lại bằng chứng để phòng trường hợp sếp "quên" mình đã làm gì.
- Ghi nhận Audit Log cực kỳ chi tiết cho hành động `UPDATE_ORDER`.
- Metadata phải lưu lại: `[Trạng thái cũ] -> [Trạng thái mới]` (Ví dụ: "Sửa số lượng Khăn lau từ 5 -> 8, Tổng tiền từ 50k -> 80k").

---

## 3. Lộ trình Triển khai (Roadmap)

- **Bước 1**: Xây dựng API `updateSalesOrder` và `updatePurchaseOrder` trong `OrderOrchestrator` với thuật toán **Auto-Delta** (Tính chênh lệch kho/tiền).
- **Bước 2**: Viết UI Form Sửa đơn hàng (Tái sử dụng Form Tạo đơn hiện tại nhưng truyền `initialData`).
- **Bước 3**: Kiểm thử (Testing) các case phức tạp: Sửa đơn đang nợ 1 phần, sửa đơn đã thanh toán full, sửa giảm số lượng sản phẩm.

*Ghi chú: Plan này thay thế hoàn toàn cho Plan quản lý Order hàn lâm trước đó.*

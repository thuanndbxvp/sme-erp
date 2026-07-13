# PLAN: Redesign Dashboard & P&L
**Document Type**: Implementation Plan
**Author**: Tier 1 Architect
**Status**: APPROVED

## 1. Tầm nhìn & Mục tiêu
Giao diện Dashboard hiện tại (Trung tâm điều hành) đang bị "tù túng", chật chội và thiếu tính trực quan. Mục tiêu của bản nâng cấp này là mang lại một giao diện Premium, thoáng đãng, chuẩn ERP hiện đại và bổ sung thêm biểu đồ Lợi Nhuận (P&L) theo yêu cầu của Giám đốc.

## 2. Kiến trúc Giao diện mới (Layout Architecture)

### Phần 1: Top KPI Cards (4 Thẻ chỉ số)
- Gồm: Tiền mặt, Phải thu, Phải trả, Lãi gộp.
- **UI/CSS**: Sử dụng thẻ Card bo góc (`border-radius: 12px`), có bóng đổ nhẹ (`box-shadow`), khoảng cách `padding: 20px`. Phông chữ to, số liệu nổi bật. Mỗi thẻ sẽ có một Icon (dùng `lucide-react`) để tăng tính sinh động.

### Phần 2: Biểu đồ Lợi Nhuận (P&L Chart) - **MỚI**
- Khu vực trung tâm sẽ là một Biểu đồ (Sử dụng thư viện `recharts`).
- **Nội dung**: Hiển thị Biểu đồ dạng Cột (Bar Chart) so sánh **Doanh Thu (Revenue)** và **Chi Phí (Expense)**.
- **Tính năng lọc**: Có một bộ lọc (Tabs hoặc Dropdown) để chuyển đổi góc nhìn:
  - Tháng này (Từng ngày trong tháng)
  - Quý này (Từng tháng trong quý)
  - Năm nay (12 tháng)
- Biểu đồ sẽ tự động tính toán Lỗ/Lãi (Net Profit) dựa trên chênh lệch.

### Phần 3: Cảnh báo Dòng tiền & Danh sách Top
- Chuyển thanh "Cảnh báo dòng tiền" thành một dải Banner có màu gradient hoặc màu nền cảnh báo nổi bật, không bị bóp méo.
- 3 Cột danh sách (Top AR, Top AP, Tồn kho): Sẽ được bọc trong 3 thẻ Card riêng biệt, nền trắng, cách nhau bởi `gap`. Bảng bên trong sẽ có đường viền mỏng và màu nền xen kẽ (Zebra stripe) để dễ đọc.

## 3. Data Fetching (Backend Logic)
- Bổ sung thêm API/Server Action để query dữ liệu Lợi Nhuận (P&L):
  - Nhóm các `Transaction` (INCOME và EXPENSE) theo thời gian (Tháng/Quý/Năm).
  - Trả về mảng JSON ví dụ: `[{ time: 'Tháng 1', revenue: 500, expense: 200 }, ...]` để `recharts` dễ dàng render.

---
*Bản thiết kế này đã được duyệt. Tầng 2 (Engineer) sẽ tiến hành cài đặt thư viện `recharts`, `lucide-react` và đập đi xây lại file `DashboardClient.tsx`.*

# Kế hoạch tối ưu UI CashflowTab (Sổ quỹ)

## 1. Mục tiêu
- **Yêu cầu 1:** Đưa 3 ô tiền (TỔNG QUỸ, BANK, CASH) ngang hàng với nút "+ Ghi nhận" trên cùng một dòng.
- **Yêu cầu 2:** Giảm thiểu kích thước và đặc biệt là **chiều cao** của 3 ô tiền này để tiết kiệm diện tích màn hình.

## 2. File cần chỉnh sửa
- Target File: `src/app/(dashboard)/cashflow/CashflowClient.tsx`
- Component: `CashflowTab`

## 3. Chi tiết triển khai

### Bước 3.1. Gộp Layout Khối Header (Summary + Button)
- Xóa bỏ thẻ `div` độc lập đang bọc nút `+ Ghi nhận` (`justifyContent: "flex-end"`).
- Tạo một thẻ `div` cha mới bọc toàn bộ phần `Summary` và nút `+ Ghi nhận`.
  - CSS cho thẻ cha: `display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-5)", marginBottom: "var(--space-5)"`.
- Đặt khối `Summary` (chứa 3 ô tiền) sang bên trái (chiếm `flex: 1`).
- Đặt nút `+ Ghi nhận` sang bên phải. 

### Bước 3.2. Cấu trúc lại Flex/Grid của khối Summary
- Khối bọc 3 ô tiền đang dùng `gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))"`. Do đặt cùng hàng với nút Ghi nhận, không gian sẽ chật hơn.
- Đổi thành `display: "flex", gap: "var(--space-3)"` để 3 ô tự động dàn ngang linh hoạt. (Hoặc `gridTemplateColumns: "repeat(3, 1fr)"`).

### Bước 3.3. Tối ưu chiều cao (Height) của từng Ô Tiền
Để ép chiều cao xuống mức tối giản, ta áp dụng chiến lược **Inline Flex** (đưa các thành phần lên cùng một dòng thay vì rớt dòng) và **Giảm Padding/Margin**:

**A. Đối với thẻ TỔNG QUỸ:**
1. Giảm `padding` từ `var(--space-4)` xuống `var(--space-3)`.
2. Đưa nhãn "TỔNG QUỸ" và Số Dư lên **cùng một dòng** (Dùng `flex, justifyContent: space-between`).
3. Dòng "Thu/Chi": Bỏ chia Grid dọc tốn diện tích, chuyển thành một dòng ngang duy nhất dưới dạng: 
   `[Thu: +503.633.305]  |  [Chi: -437.749.144]` (chữ nhỏ hơn `text-xs`, margin gọn lại).
4. Giảm cỡ chữ tổng: Chữ số dư khổng lồ `var(--text-2xl)` xuống còn `var(--text-xl)` hoặc `var(--text-lg)` nhưng in đậm.
5. Xóa bỏ thẻ `<br />` không cần thiết.

**B. Đối với các thẻ tài khoản (BANK, CASH):**
1. Giảm `padding` xuống `var(--space-3)`.
2. Hàng 1: Đưa Tên thẻ (`a.code`) và Số dư lên **cùng một dòng** (Sử dụng `flex, justifyContent: space-between`).
3. Hàng 2: Tương tự Tổng quỹ, đưa "Thu/Chi" thành một dòng chú thích nhỏ (`text-xs`) đặt dưới tên thẻ.
4. Loại bỏ hoàn toàn đường kẻ `borderTop` phân cách Số dư để tiết kiệm khoảng trống dọc.

### Bước 3.4. Cấu hình lại vị trí của Form Ghi Nhận (`showForm`)
- Di chuyển cục `showForm && (...)` ra **bên dưới** thẻ bọc Header mới (tức là nằm giữa khối Tiền+Nút và Bảng Giao dịch).
- Giữ nguyên logic hiển thị `showForm` như cũ.

## 4. Tiêu chí hoàn thành (DoD)
- Không làm vỡ layout khi co kéo màn hình (sử dụng flex-wrap nếu cần để tránh nút Ghi nhận bị lẹm).
- 3 thẻ tiền phải hiển thị siêu mỏng, chỉ gồm khoảng 2 dòng text nội dung (dòng 1: Tiêu đề + Số dư, dòng 2: Thu/Chi).
- Không được làm ảnh hưởng đến dữ liệu hay logic React của file.

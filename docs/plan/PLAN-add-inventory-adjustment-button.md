# Kế hoạch Thêm nút "Điều chỉnh tồn kho" ra danh sách sản phẩm

## 1. Yêu cầu & Phân tích
- **Yêu cầu 1:** Thêm chức năng "Điều chỉnh kho" trực tiếp ra ngoài danh sách sản phẩm (`ProductListPage`), cạnh các nút Xem và Sửa.
- **Yêu cầu 2:** CSS cho 3 nút này (Xem, Sửa, Điều chỉnh) phải "đẹp và nổi bật hơn".
- **Giải pháp:** 
  - Đưa Component `AdjustForm` (vốn đang dùng trong trang chi tiết) ra ngoài màn hình danh sách. 
  - Để tránh việc click mở form làm vỡ bảng (table), form điều chỉnh sẽ được nâng cấp thành dạng Popover (hiển thị đè lên trên bằng `position: absolute`).
  - Nâng cấp CSS của cụm nút Xem/Sửa thành các block màu nổi bật hoặc dùng biến CSS đồng bộ.

## 2. File chịu ảnh hưởng
1. `src/components/inventory/AdjustForm.tsx`: Chuyển từ dạng inline form sang Popover form, chuẩn hóa lại kích thước nút bấm.
2. `src/app/(dashboard)/catalog/product/page.tsx`: Thêm import `AdjustForm`, sửa lại cột Action của bảng để chứa 3 nút với CSS mới (Flexbox, gap, outline colors).

## 3. Kiến trúc thiết kế
- Nút "👁 Xem": Viền xanh (`primary`), chữ xanh.
- Nút "✏ Sửa": Viền xám nhạt (`border-strong`), chữ xám.
- Nút "⚠ Điều chỉnh": Nền cam/vàng (`warning`), chữ trắng, đổ bóng nổi bật.
- Form AdjustForm: Nằm absolute ngay dưới nút bấm, có box-shadow lớn để phân biệt với nền bảng.

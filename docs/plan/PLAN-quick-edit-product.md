# Kế hoạch Thêm Popup "Sửa nhanh" cho sản phẩm

## 1. Yêu cầu & Phân tích
- **Yêu cầu:** Sửa nút "Sửa" trong danh sách sản phẩm thành dạng popup sửa nhanh (Quick Edit Popover), giống với cách hoạt động của nút "Điều chỉnh" vừa làm.
- **Giải pháp:** 
  - Tạo mới một Client Component `QuickEditProductForm` chịu trách nhiệm hiển thị nút bấm và form popup chứa các trường cơ bản (Tên, ĐVT, Giá bán, Giá nhập).
  - Form này gọi hàm Server Action `updateCatalogItem` để cập nhật trực tiếp DB mà không cần chuyển trang.
  - Thay thế Link "Sửa" cũ trong bảng `ProductListPage` bằng component mới này.

## 2. File chịu ảnh hưởng
1. `src/components/catalog/QuickEditProductForm.tsx` (Tạo mới): Chứa UI form popup absolute và logic form submit.
2. `src/app/(dashboard)/catalog/product/page.tsx`: Sửa đổi Cột Action, Import component mới để thay thế nút Sửa cũ.

## 3. Kiến trúc thiết kế
- Nút "✏ Sửa" hoạt động tương tự "⚠ Điều chỉnh" (Toggle Popover).
- Popover có nút X để tắt, có trạng thái hiển thị thông báo lỗi/thành công.
- Không phá vỡ luồng Layout của bảng (position: absolute, zIndex cao).

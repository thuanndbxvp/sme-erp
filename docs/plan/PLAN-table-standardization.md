# PLAN: Chuẩn hóa toàn bộ Bảng biểu trong Hệ thống (Thêm STT và Phân trang)

## 1. Bối cảnh & Mục tiêu
- **Hiện trạng:** Hầu hết các bảng (Table) trong UI như danh sách đơn hàng, hoá đơn, khách hàng, báo cáo công nợ... đang thiếu cột Số Thứ Tự (STT) và chưa có cơ chế phân trang (Pagination) hợp lý, dẫn đến khi dữ liệu phình to sẽ làm tràn màn hình, giảm hiệu năng và trải nghiệm.
- **Mục tiêu:** Rà soát và cập nhật đồng loạt các file UI có chứa `<table...>` để:
  1. Thêm cột đầu tiên là **STT**.
  2. Áp dụng phân trang (Pagination) chuẩn xác. Công thức tính STT: `(currentPage - 1) * pageSize + index + 1`.

## 2. Phạm vi ảnh hưởng (Các file cần sửa)
1. **Quản trị hệ thống:** `users/UsersClient.tsx`, `roles/RolesClient.tsx`.
2. **Khách hàng / NCC:** `customers/[id]/page.tsx`, `suppliers/[id]/page.tsx`.
3. **Sản phẩm:** `catalog/product/page.tsx`, `products/[id]/page.tsx`.
4. **Tài chính & Dòng tiền:** `cashflow/CashflowClient.tsx`, `debts/page.tsx` (và `AgingView.tsx`), `reports/page.tsx`.
5. **Đơn hàng:** `orders/OrderTabsClient.tsx` (đã có phân trang, chỉ cần thêm STT).

## 3. Chiến lược Phân trang
Có 2 nhóm dữ liệu:
- **Nhóm 1: Server-Side Data (Dữ liệu lấy từ Prisma với take/skip):** Các trang gọi DB với cục dữ liệu lớn (như Đơn hàng). Dùng component `<Pagination />` có sẵn ở `src/components/ui/Pagination.tsx` (dựa trên URL query `?page=x`).
- **Nhóm 2: Client-Side / Memory Data:** Dữ liệu tính toán gộp (như Công nợ AgingView) hoặc dữ liệu từ Client state. Sẽ dùng kỹ thuật `.slice((page - 1) * limit, page * limit)` để phân trang ngay tại Client (hoặc dựa vào query param nếu là Server component). Limit mặc định: `20` dòng/trang.

Chiến dịch này sẽ được thiết kế chi tiết trong MSEW để Tầng 2 có thể quét lần lượt các file mà không bỏ sót.

# PLAN: Cấp phát quyền Thêm/Sửa/Xóa Khách hàng & NCC cho Admin

## 1. Bối cảnh
Người dùng (đang đăng nhập bằng tài khoản `admin`) bị lỗi "Bạn không có quyền thực hiện thao tác này" khi cố gắng Thêm Nhà cung cấp (hoặc Khách hàng).
Nguyên nhân: Mặc dù user là ADMIN, nhưng hệ thống phân quyền (RBAC) yêu cầu cụ thể các mã quyền như `customer.write`, `supplier.write`. Nếu các mã quyền này chưa được khai báo trong bảng `Permission` hoặc chưa được map với `Role` (ADMIN) trong bảng `RolePermission`, hệ thống sẽ chặn thao tác.

## 2. Chi tiết công việc
Tạo một script khởi tạo/bổ sung (seed) các quyền quản lý danh mục (Catalog) bao gồm:
- `customer.read`, `customer.write`
- `supplier.read`, `supplier.write`
- `product.read`, `product.write`
- `warehouse.read`, `warehouse.write`

Sau đó gán tự động toàn bộ các quyền này cho role `ADMIN`.

Điều này sẽ sửa dứt điểm lỗi Access Denied khi truy cập các form tạo/sửa Khách hàng, NCC, Sản phẩm.

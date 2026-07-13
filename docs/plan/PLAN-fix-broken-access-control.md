# PLAN: Khắc phục lỗi Broken Access Control (Phân quyền Server Components)

## 1. Mục tiêu
Vá 5 lỗ hổng mức độ CRITICAL liên quan đến rò rỉ dữ liệu tài chính và hệ thống cho các vai trò không có quyền hạn (ví dụ: Nhân viên Sales xem được báo cáo P&L và quỹ tiền mặt).

## 2. Nguyên nhân
Các trang Dashboard hiện tại (như `/cashflow`, `/debts`, `/reports`...) đều là các Server Component. Code hiện tại mới chỉ kiểm tra đăng nhập (`await auth()`) nhưng **chưa kiểm tra phân quyền** (RBAC). Do đó, Prisma vẫn thực thi query và trả về HTML chứa dữ liệu cho bất kỳ ai có tài khoản hợp lệ.

## 3. Giải pháp thi hành (Dành cho Tier 2)
Áp dụng cơ chế bảo vệ Server Component chuẩn của dự án:
Bổ sung hàm `requirePermission` ngay trên cùng của logic component, trước khi thực hiện bất kỳ lệnh gọi DB nào. Hành động này sẽ ném ra lỗi hoặc chuyển hướng người dùng nếu họ không có quyền.

## 4. Danh sách các màn hình cần vá
- **Cashflow:** Chỉ người có quyền `cashflow.view` mới được xem.
- **Debts:** Chỉ người có quyền `debt.view` mới được xem.
- **Reports:** Chỉ người có quyền `report.view` mới được xem.
- **Orders:** Chỉ người có quyền `order.view` mới được xem.
- **Users:** Chỉ Admin (`system.admin`) mới được vào xem danh sách tài khoản.

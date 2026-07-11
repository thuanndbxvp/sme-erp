# PLAN: Advanced RBAC & UI Polish (Nâng cấp Phân quyền & Giao diện)

## Kiến trúc tổng quan
Để biến SME ERP thành một phần mềm có trải nghiệm "hạng thương gia", ngoài việc API trả về đúng dữ liệu, giao diện (UI) cũng phải thông minh và đẹp.

**Vấn đề hiện tại:**
1. Các chức năng nhạy cảm (Quỹ tiền, Báo cáo lãi lỗ) đang phơi bày cho tất cả nhân viên. Dù Tầng API đã chặn (báo lỗi 403 Unauthorized), nhưng việc User thấy menu, bấm vào rồi mới bị chửi là trải nghiệm RẤT TỆ.
2. Thiết kế thẻ (Cards), bảng (Tables) đang khá cơ bản, chưa tạo được cảm giác tin cậy của một phần mềm tài chính.

**Quyết định kiến trúc của Tầng 1:**
- **UI-Level RBAC (Role-Based Access Control):** Khóa menu ngay từ giao diện. Đọc `session.user.role` từ NextAuth và triệt tiêu các nhánh DOM không thuộc thẩm quyền của User.
  - **SALE (Sale):** Chỉ thấy Đơn Hàng, Khách Hàng, Sản Phẩm.
  - **ACCOUNTANT (Kế toán):** Thấy Thu Chi, Quỹ, Công Nợ. Không được quyền tạo đơn.
  - **ADMIN (Giám đốc):** Thấy tất cả.
- Nâng cấp UI component bằng chuẩn thiết kế chuyên nghiệp (ví dụ: áp dụng các thẻ Card nổi khối, Table viền mỏng).

## Luồng dữ liệu (Data Flow)
1. Trong Server Component (hoặc Client layout), gọi `await auth()` để lấy Session.
2. Truyền `role` xuống `Sidebar` và `Dashboard`.
3. Filter (lọc) danh sách Navigation. Nếu User có role `SALE`, mảng Navigation sẽ bị cắt bỏ các object thuộc nhóm `TÀI CHÍNH` và `BÁO CÁO`.
4. Render UI sạch sẽ, gọn gàng đúng với chức danh của người đang đăng nhập.

## Danh sách file cần sửa
1. `src/components/layout/Sidebar.tsx` (Thêm logic Filter Menu theo Role)
2. Cấu hình lại các file `page.tsx` để ẩn các Widget nhạy cảm (Ví dụ: Giấu Widget Tiền mặt trên Dashboard nếu không phải Admin/Kế toán).

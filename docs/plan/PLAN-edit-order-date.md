# PLAN: Bổ sung tính năng Sửa ngày Đơn hàng (Backdate)

## 1. Mục tiêu
Cho phép người dùng sửa lại ngày bán (`saleDate`) và ngày nhập (`orderDate`) của các đơn hàng cũ ngay trên giao diện `EditOrderClient`. 
Tính năng này cực kỳ cần thiết trong giai đoạn đầu áp dụng phần mềm (cần nhập liệu song song hoặc hồi tố), nhưng cũng tiềm ẩn rủi ro thao túng số liệu.

## 2. Giải pháp Bảo mật (RBAC)
- Tạo một quyền (permission) mới hoàn toàn tách biệt: `order.edit_date` (Sửa ngày tạo đơn).
- Chỉ những User/Role được gán quyền này mới nhìn thấy ô sửa ngày trên giao diện và gọi được API sửa ngày.
- Khi giai đoạn nhập liệu khởi tạo kết thúc, Admin có thể vào phần Cài đặt Vai trò (Roles) để tháo quyền này ra, ngăn chặn vĩnh viễn việc nhân viên fake đơn về quá khứ.

## 3. Các thành phần cần cập nhật (Tier 2 thực thi)
1. **Database / Seeding:** Khởi tạo record quyền `order.edit_date` vào bảng `Permission`.
2. **UI (Trang Edit Order):** 
   - Server Component (`page.tsx`) check quyền `order.edit_date` của user hiện tại và truyền cờ `canEditDate` xuống Client.
   - Client Component (`EditOrderClient.tsx`) hiển thị input datepicker nếu `canEditDate = true`.
3. **Server Actions:**
   - Cập nhật `editSalesOrderAction` và `editPurchaseOrderAction`.
   - Nếu payload có gửi lên ngày mới, backend BẮT BUỘC phải gọi `requirePermission(session?.user?.id, "order.edit_date")` để chống hack qua API.
4. **Service (Orchestrator):** Cập nhật schema prisma và `OrderOrchestrator` truyền tham số ngày để save vào DB.

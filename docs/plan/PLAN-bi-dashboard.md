# PLAN: Executive BI Dashboard (Trung tâm Điều hành)

## Kiến trúc tổng quan
Theo định hướng của sếp, chúng ta sẽ ưu tiên việc "đọc vị" sức khỏe doanh nghiệp trước (Lựa chọn 2). Đối với một Giám đốc SME, Dashboard không cần quá nhiều biểu đồ rác, mà phải hiển thị 3 con số sinh mệnh:
1. **Tiền tươi (Cash in Bank):** Đang có bao nhiêu tiền thực tế trong két.
2. **Huyết áp dòng tiền (Cashflow Health):** Sắp tới thu bao nhiêu (AR), trả bao nhiêu (AP). Công thức sinh tồn: `Tiền tươi + Phải thu - Phải trả`. Nếu con số này âm, công ty sắp phá sản.
3. **Lãi gộp trong tháng (Monthly Gross Profit):** Tính tổng từ lợi nhuận các đơn hàng đã chốt (dựa trên WAC).

**Quyết định kiến trúc:**
- Tách riêng một `DashboardService` chỉ làm nhiệm vụ Query Data tổng hợp.
- Sử dụng Prisma Aggregate để lấy sum (tổng) trực tiếp từ Database, tuyệt đối không dùng `findMany` rồi vòng lặp `reduce` bằng Javascript để tránh tràn RAM.

## Luồng dữ liệu (Data Flow)
1. User (Giám đốc) truy cập vào trang chủ `/(dashboard)/page.tsx`.
2. Next.js Server Component gọi `DashboardService.getExecutiveStats()`.
3. Prisma chọc thẳng vào Postgres dùng hàm `SUM()` trên các bảng: `Account`, `Invoice` (AR/AP), `SalesOrderItem`.
4. Trả về object JSON chứa 4 chỉ số -> Render ra UI qua các Thẻ (Card).

## Danh sách file cần sửa
1. **Tạo mới:** `src/services/dashboard.service.ts`
2. **Cập nhật:** `src/app/(dashboard)/page.tsx` (hoặc `src/app/page.tsx` nếu chưa dời xong ở phase trước).

# BRAINSTORMING: Các bước đi chiến lược tiếp theo (Next Epics)

*Tài liệu trình bày 3 hướng đi tiếp theo cho hệ thống SME ERP sau khi đã ổn định hạ tầng (Core & Performance).*

---

## 🚀 Lựa chọn 1: Automation & Background Jobs (Tự động hóa)
**Vấn đề:** Hiện tại DB đã có bảng `OutboxEvent` dùng để chứa các sự kiện bất đồng bộ (gửi email, gọi API hóa đơn điện tử, gọi bên vận chuyển), nhưng chưa có "Cỗ máy" nào đứng ra chạy để dọn dẹp bảng này.
**Giải pháp:**
- Tích hợp **Upstash QStash** hoặc **Vercel Cron** để làm Background Worker Serverless.
- Tự động quét các hóa đơn quá hạn (Overdue Invoices) để gửi Email/Zalo nhắc nợ khách hàng.
- Tự động rà soát kho, gửi báo cáo hàng tồn dưới mức tối thiểu (Low Stock Alert) cho Giám đốc mỗi 8h sáng.

## 📊 Lựa chọn 2: Executive BI Dashboard (Trung tâm Điều hành)
**Vấn đề:** Giám đốc SME cần nhìn thấy "Sức khỏe" của công ty ngay khi mở app lên, thay vì phải xuất Excel.
**Giải pháp:**
- Xây dựng Dashboard Quản trị tập trung.
- **Cashflow Forecasting:** Vẽ biểu đồ dự báo "Sức khỏe dòng tiền" trong 30 ngày tới = (Tiền mặt hiện tại + Các khoản sắp thu) - (Các khoản sắp phải trả).
- **Real-time Profitability:** Lấy Giá Bán trừ đi Giá Vốn Bình Quân (WAC) để ra Lãi Gộp từng Đơn hàng và từng Ngày.

## 🛡️ Lựa chọn 3: Advanced RBAC & UI Polish (Nâng cấp Phân quyền & Trải nghiệm)
**Vấn đề:** Giao diện có thể đang hiển thị quá nhiều tính năng cho tất cả mọi người. Nhân viên Sale không nên nhìn thấy Quỹ Tiền. Kế toán không nên được tạo đơn bán.
**Giải pháp:**
- Tích hợp **RBAC (Role-Based Access Control)** chặt chẽ tới từng Nút bấm (Button) và Route.
- Nâng cấp UI Dashboard bằng Shadcn UI / Radix để giao diện mang cảm giác "Pro Max", mượt mà và bóng bẩy như các app FinTech hàng đầu.

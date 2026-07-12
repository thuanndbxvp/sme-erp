# SỔ TAY KIẾN THỨC NGHIỆP VỤ (DOMAIN KNOWLEDGE)
*Dành cho Đội ngũ Kỹ thuật và AI Pipeline phát triển SME-ERP*

Là người điều hành doanh nghiệp thương mại và chịu trách nhiệm cao nhất về mặt kỹ thuật (Tech Lead/CTO), tôi biên soạn tài liệu này để định hướng cho mọi quyết định thiết kế và lập trình. 

ERP của chúng ta không chỉ là một phần mềm ghi chép dữ liệu, nó là **hệ thần kinh** của doanh nghiệp. Mọi dòng code viết ra phải phục vụ mục đích: **Kiểm soát chặt chẽ, Vận hành tinh gọn, và Minh bạch dòng tiền**.

---

## 1. CÁC LUỒNG NGHIỆP VỤ CỐT LÕI (CORE BUSINESS FLOWS)

Mọi module trong hệ thống xoay quanh 4 trụ cột nghiệp vụ chính:

### A. Quản lý Bán hàng & Doanh thu (Order to Cash)
- **Luồng:** Báo giá -> Tạo đơn hàng (Order) -> Xuất kho -> Ghi nhận doanh thu -> Thu tiền/Ghi nhận công nợ.
- **Quy tắc:**
  - Giá bán (`sellPrice`) linh hoạt nhưng không được thấp hơn giá vốn (`buyPrice`) nếu không có sự phê duyệt.
  - Mỗi đơn hàng xuất đi đồng nghĩa với việc Số lượng tồn kho giảm ngay lập tức (Real-time).

### B. Quản lý Mua hàng & Chi phí (Procure to Pay)
- **Luồng:** Yêu cầu mua hàng -> Tạo đơn nhập hàng -> Nhập kho -> Thanh toán/Ghi nhận công nợ với Nhà cung cấp (Supplier).
- **Quy tắc:**
  - Giá vốn hàng hóa phải được cập nhật trung bình gia quyền (hoặc FIFO tùy chuẩn) mỗi khi có đợt nhập mới.
  - Phải check constraints (ràng buộc) chặt chẽ: Không thể xóa một phiếu nhập kho nếu hàng đó đã xuất bán.

### C. Quản lý Kho bãi (Inventory & Warehousing)
- **Luồng:** Nhập hàng, Xuất hàng, Kiểm kê (Stocktake), Luân chuyển.
- **Khái niệm:** 
  - **Nhập-Xuất-Tồn:** Báo cáo sống còn của kho. Dữ liệu Đầu kỳ + Nhập trong kỳ - Xuất trong kỳ = Tồn cuối kỳ.
  - Không bao giờ được phép có số tồn kho âm (Negative stock) trong hệ thống sản xuất.

### D. Quản lý Dòng tiền & Sổ quỹ (Cashflow & Finance)
- **Khái niệm:** Tài khoản (Accounts) và Hạng mục (Categories) thu chi.
- **Quy tắc:**
  - Tiền mặt/Tiền gửi chỉ dịch chuyển qua các giao dịch `Cashflow`. Có luồng `In` (Thu) và `Out` (Chi).
  - Khách hàng nợ tiền (Accounts Receivable) và Chúng ta nợ Nhà cung cấp (Accounts Payable) gọi chung là **Công nợ**.
  - Không cho phép can thiệp thẳng vào dữ liệu sổ quỹ bằng SQL ngoại trừ thông qua các API có kiểm soát quyền (RBAC).

---

## 2. NGUYÊN TẮC THIẾT KẾ KỸ THUẬT (ENGINEERING PRINCIPLES)

1. **Bảo vệ toàn vẹn dữ liệu (Data Integrity):**
   - Áp dụng Foreign Key và Check Constraints nghiêm ngặt ở tầng Database. Ví dụ: Ràng buộc xóa (Cascade Delete) cần bị cấm ở các dữ liệu giao dịch tài chính (ví dụ không xóa khách hàng nếu khách vẫn còn nợ hoặc lịch sử mua hàng). Soft Delete (`is_deleted = true`) là bắt buộc đối với các Master Data.

2. **Giao diện chuẩn mực (UI/UX Standardization):**
   - Mọi bảng dữ liệu (Tables) ở các phân hệ Order, Customer, Supplier, Debt phải có cấu trúc nhất quán:
     - Luôn có cột số thứ tự (STT).
     - Phân trang (Pagination) bắt buộc trên backend để bảo vệ hiệu năng.
     - Thanh công cụ Search/Filter đặt cố định vị trí.
   
3. **Hiệu năng & Khả năng mở rộng:**
   - Khi tính toán Báo cáo tài chính hoặc Nhập xuất tồn: Ưu tiên dùng Index trên DB hoặc xử lý tính toán nền thay vì lặp qua mảng trên Frontend.
   - Các API phải có fallback cơ bản và trả về format response đồng nhất: `{ status: 'success' | 'error', data: ..., message: ... }`.

4. **Bảo mật và Phân quyền (RBAC):**
   - Mọi API tạo, sửa, xóa (CRUD) các hạng mục quan trọng (như Cashflow Settings, Master Data) phải yêu cầu role quản trị. Các luồng chỉ xem (Read-only) phân quyền linh hoạt hơn cho nhân viên.

---

## 3. THUẬT NGỮ THƯỜNG DÙNG (GLOSSARY)

Để đảm bảo anh em kỹ thuật hiểu đúng ý định của nghiệp vụ (Business Intent), chúng ta quy định các thuật ngữ sau:
- **Order (Đơn hàng):** Phản ánh giao dịch bán ra.
- **Supplier (Nhà cung cấp):** Nơi chúng ta nhập hàng, phát sinh công nợ phải trả.
- **Customer (Khách hàng):** Người mua hàng, phát sinh công nợ phải thu.
- **Cashflow (Dòng tiền):** Các giao dịch thực tế vào/ra khỏi két hoặc tài khoản ngân hàng.
- **Ledger (Sổ cái):** Nơi ghi nhận tổng hợp tài chính.

*Bất kỳ ai tham gia vào dự án này (kể cả AI) đều phải nghiền ngẫm file này trước khi kiến trúc hay viết bất cứ một dòng code nào.*

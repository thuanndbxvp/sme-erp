# DOMAIN KNOWLEDGE: SME ERP SYSTEM
*Tài liệu nền tảng kiến trúc nghiệp vụ dành cho toàn bộ Hệ thống AI Pipeline.*
*Được biên soạn dưới góc nhìn của Giám đốc SME, Chuyên gia ERP & Tech Lead 10 năm kinh nghiệm.*

## 1. NGUYÊN TẮC TÀI CHÍNH & KẾ TOÁN (SINGLE SOURCE OF TRUTH)
- **Tiền tuyệt đối không dùng Float:** Mọi trường liên quan đến Tiền, Số lượng có thập phân phải dùng `Decimal(15,2)`. Lỗi làm tròn 1 đồng cũng là không thể chấp nhận trong ERP.
- **Công nợ nằm ở Hóa đơn (Invoice), không phải Đơn hàng (Order):** Đơn hàng (`SalesOrder`, `PurchaseOrder`) chỉ là thỏa thuận mua bán. Trạng thái thanh toán (`PaymentStatus`) của Đơn hàng phải được **DERIVE (tính toán suy ra)** từ `Invoice.balanceDue`. Tuyệt đối không cập nhật trạng thái thanh toán bằng tay lên Đơn hàng.
- **Nguyên tắc Khóa sổ (Period Lock):** Dữ liệu tài chính, kho bãi sau khi đã chốt kỳ (báo cáo thuế, chia hoa hồng) là **BẤT BIẾN (Immutable)**. Nghiêm cấm mọi hành vi UPDATE/DELETE trực tiếp vào DB đối với dữ liệu trước `PERIOD_LOCK_DATE`. Nếu sai sót, bắt buộc dùng bút toán điều chỉnh (Debit/Credit Note hoặc Adjustments).

## 2. QUẢN TRỊ KHO BÃI (INVENTORY MANAGEMENT)
- **Tồn kho là kết quả của Dòng chảy (Event Sourcing):** Không bao giờ được phép `UPDATE WarehouseInventory SET quantity = quantity + 1`. Tồn kho hiện tại phải là tổng của tất cả các lịch sử nhập xuất (`InventoryMovement`). Mỗi lần biến động phải sinh ra 1 dòng IN/OUT bất biến.
- **Negative Inventory Guard (Chống xuất âm):** Bất kể lý do gì, kho hệ thống không được phép âm (ngoại trừ các kho trung chuyển được cấu hình đặc biệt). Logic phải chặn cứng xuất hàng nếu `quantity < required`.
- **Giá vốn bình quân (WAC - Weighted Average Cost):** Lãi gộp của đơn hàng phải được tính tức thời tại thời điểm xuất kho dựa trên WAC, không lấy `Giá Bán - Giá Mua Bảng Giá`. WAC được cập nhật lại sau mỗi lần nhập hàng (Purchase Receipt).

## 3. VẬN HÀNH & BẢO MẬT (OPERATIONS & SECURITY)
- **Idempotency (Chống thao tác kép):** Mọi webhook thanh toán, API tạo đơn, chuyển trạng thái phải có `idempotencyKey` hoặc cờ chống click đúp. Không bao giờ được phép tạo ra 2 đơn hàng hoặc 2 phiếu thu do user lag mạng.
- **Audit Trail (Dấu vết kiểm toán):** Mọi thao tác CREATE/UPDATE/DELETE lên các đối tượng nhạy cảm (Tài khoản ngân hàng, Hóa đơn, Đơn hàng) phải được log lại vào bảng `AuditLog`. "Không có niềm tin mù quáng vào Admin".
- **RBAC (Role-Based Access Control):** Tách bạch quyền hạn (Segregation of Duties). Sale không được duyệt chi, Thủ kho không được xem giá vốn, Kế toán không được tự ý xuất kho.

## 4. QUY TRÌNH NGHIỆP VỤ CỐT LÕI (CORE WORKFLOWS)
- **Mô hình Dropship:** Mua từ Nhà cung cấp (Supplier) -> Giao thẳng cho Khách hàng (Customer). Giao dịch này phải móc nối `linkedPurchaseOrderId` vào `SalesOrder` và bỏ qua quy trình nhập/xuất kho vật lý.
- **Vòng đời Đơn hàng (Order Lifecycle):**
  - Mua hàng: `ORDERED` (Đã đặt) -> `RECEIVED` (Đã nhận hàng - sinh phiếu nhập kho).
  - Bán hàng: `PENDING` (Chờ xử lý) -> `DELIVERED` (Đã giao - sinh phiếu xuất kho, trừ tồn).
  - Terminal State: Khi đã chuyển sang `DELIVERED` hoặc `CANCELLED`, đơn hàng bị khóa, không được thêm bớt Item.

## 5. TECH STACK & TIÊU CHUẨN CODE (CODING STANDARDS)
- Sử dụng **Prisma + PostgreSQL** với transactions (`$transaction`) cho các chuỗi thao tác liên hoàn (Ví dụ: Thanh toán -> Trừ công nợ -> Đổi trạng thái).
- Mọi API endpoint phải bọc Zod Validation cho Payload. Chống mọi loại Injection và IDOR (Insecure Direct Object Reference).
- Luôn ưu tiên viết logic kinh doanh vào Tầng Service (`/src/services`), không viết chìm trong Next.js API Routes hay React Components.

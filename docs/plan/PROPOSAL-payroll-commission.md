# PROPOSAL: HỆ THỐNG LƯƠNG & HOA HỒNG (PAYROLL & COMMISSION)
**Document Type**: Architectural Proposal
**Author**: Tier 1 Architect
**Target**: SME (Small & Medium Enterprise)

---

## 1. BÀI TOÁN THỰC TẾ
Trong các doanh nghiệp SME, cơ chế trả lương cho bộ phận Kinh doanh (Sales) thường bao gồm:
`Tổng Thu Nhập = Lương Cơ Bản + Hoa Hồng Bán Hàng - Tạm Ứng/Phạt`

**Tuy nhiên, Hoa hồng sinh ra 3 vấn đề đau đầu nhất:**
1. **Tính trên Doanh thu hay Lợi nhuận?** Nếu tính trên Doanh thu, Sale sẽ lạm dụng chiết khấu sâu để chốt đơn -> Công ty bán được hàng nhưng lỗ. (Khuyến nghị: Tính trên Lợi nhuận gộp).
2. **Ghi nhận khi nào?** Nếu tính hoa hồng ngay khi Lên đơn, nhỡ khách boom hàng hoặc nợ xấu thì Sale vẫn ẵm tiền. (Khuyến nghị: Chỉ chốt hoa hồng khi Khách đã thanh toán 100%).
3. **Cơ chế tính linh hoạt:** Có đơn hoa hồng 5%, có đơn khó bán sếp duyệt hoa hồng cứng 1.000.000đ. Không thể cấy cứng 1 tỷ lệ % vào bảng User.

---

## 2. CÁC MÔ HÌNH ĐỀ XUẤT (TỪ DỄ ĐẾN KHÓ)

### Mô hình 1: Lương cứng + Hoa hồng % Doanh Thu (Siêu Tinh Gọn)
- **Cách làm:** Thêm `baseSalary` và `commissionRate` vào bảng `User`. Cuối tháng hệ thống lấy tổng Doanh thu các đơn hàng của Sale đó nhân với `commissionRate`.
- **Ưu điểm:** Code cực nhanh (1 buổi là xong).
- **Nhược điểm:** Thiếu linh hoạt. Không khống chế được việc Sale bán lỗ. Rủi ro trả hoa hồng cho cả nợ xấu.

### Mô hình 2: Hoa hồng gắn vào Đơn Hàng (SME Chuẩn - KHUYẾN NGHỊ)
- **Cách làm:** 
  - Thêm bảng `EmployeeContract` (Hợp đồng nhân sự) chứa `baseSalary`.
  - Trên mỗi Đơn bán hàng (`SalesOrder`), thêm trường `commissionAmount` (Tiền hoa hồng cụ thể của đơn này).
  - Khi lên đơn, hệ thống tự động gợi ý Hoa hồng (VD: 10% Lãi gộp của đơn). Quản lý có thể sửa tay con số này trước khi Duyệt đơn.
  - Hoa hồng này chỉ chuyển sang trạng thái "Được rút" (Available) khi Đơn hàng chuyển sang `PAID` (Khách đã trả đủ tiền).
- **Ưu điểm:** Kiểm soát được lợi nhuận trên từng đơn. Tránh rủi ro nợ xấu. Sale tự nhìn thấy số tiền sẽ nhận được nếu đòi được nợ -> Kích thích Sales đi đòi nợ.
- **Nhược điểm:** Vận hành cần cẩn thận hơn, Quản lý phải ngó qua xem tiền hoa hồng của từng đơn có hợp lý không.

### Mô hình 3: Hoa hồng theo Bậc Thang & Sản Phẩm (Enterprise)
- **Cách làm:** Xây bảng cấu hình KPI. Bán dưới 100tr được 2%, từ 100-500tr được 5%. Sản phẩm A hoa hồng 10k/cái, sản phẩm B hoa hồng 5%.
- **Đánh giá:** Quá cồng kềnh, chi phí xây dựng cao, phù hợp với các tập đoàn BĐS, Bảo hiểm hơn là SME thương mại.

---

## 3. KIẾN TRÚC ĐỀ XUẤT (DỰA THEO MÔ HÌNH 2)

**A. Database Schema Changes:**
```prisma
model EmployeeProfile {
  id         String   @id @default(cuid())
  userId     String   @unique
  baseSalary Decimal  @default(0) @db.Decimal(15, 2)
  bankName   String?
  bankAccount String?
  user       User     @relation(fields: [userId], references: [id])
}

// Bổ sung vào SalesOrder hiện tại
model SalesOrder {
  // ... các field cũ
  commissionAmount Decimal @default(0) @db.Decimal(15, 2) // Tổng tiền HH cho đơn này
  commissionStatus String  @default("PENDING") // PENDING -> AVAILABLE (khi khách trả đủ) -> PAID (đã trả cho Sale)
}

// Bảng Bảng Lương Tháng (Payroll)
model Payroll {
  id               String   @id @default(cuid())
  userId           String
  month            Int
  year             Int
  baseSalaryAmount Decimal  @db.Decimal(15, 2)
  commissionAmount Decimal  @db.Decimal(15, 2) // Tổng các commissionStatus = AVAILABLE trong tháng
  deductionAmount  Decimal  @default(0) @db.Decimal(15, 2) // Trừ tạm ứng
  netPay           Decimal  @db.Decimal(15, 2) // Thực lãnh
  status           String   @default("DRAFT") // DRAFT, APPROVED, PAID
}
```

**B. Quy trình vận hành (Workflow):**
1. Nhập liệu: Admin cài Lương cứng cho Sale.
2. Bán hàng: Sale chốt đơn. Hệ thống tính tự động HH = 5% Lãi gộp. Admin chốt đơn. Hoa hồng nằm ở trạng thái "Chờ khách trả tiền" (PENDING).
3. Đòi nợ: Khách chuyển khoản. Kế toán gạch nợ thành công (Invoice -> PAID). Tự động kích hoạt HH của đơn đó sang "Có thể rút" (AVAILABLE).
4. Cuối tháng: Bấm 1 nút "Chốt lương". Hệ thống gom (Lương cứng) + (Hoa hồng AVAILABLE) - (Tạm ứng) ra phiếu Lương. Kế toán xuất File Excel đi chuyển khoản ngân hàng.

---
**Quyết định của Sếp:**
Nếu sếp ưng ý với **Mô hình 2**, hãy phản hồi để tôi xuất thành Bản vẽ `PLAN` và `MSEW` chính thức để triển khai!

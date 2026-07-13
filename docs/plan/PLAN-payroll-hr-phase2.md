# PLAN: Module Nhân Sự & Tiền Lương (Phase 2 - Chốt Lương)
**Document Type**: Implementation Plan
**Author**: Tier 1 Architect
**Status**: APPROVED

## 1. Bối cảnh & Tầm nhìn Phase 2
Phase 1 đã xây dựng được "Nợ Tạm Ứng" và "Hoa hồng chờ duyệt". Ở Phase 2, chúng ta giải quyết bài toán "Chốt sổ cuối tháng".
Thay vì chỉ trừ lùi con số, hệ thống sẽ sinh ra một **Phiếu Lương (Payslip)** lưu lại lịch sử rõ ràng (Tháng nào? Lương cứng bao nhiêu? Hoa hồng bao nhiêu? Đã cấn trừ bao nhiêu tiền tạm ứng? Thực lãnh bao nhiêu?).

## 2. Kiến Trúc Dữ Liệu (Database Schema)
Bổ sung bảng `Payslip` để lưu trữ lịch sử lương:
```prisma
model Payslip {
  id               String   @id @default(cuid())
  userId           String
  month            Int
  year             Int
  baseSalaryAmount Decimal  @db.Decimal(15, 2)
  commissionAmount Decimal  @db.Decimal(15, 2)
  advanceDeduction Decimal  @db.Decimal(15, 2) // Số tiền tạm ứng bị cấn trừ
  netPay           Decimal  @db.Decimal(15, 2) // Thực lãnh (Két cty bay đúng số này)
  transactionId    String?  // Link tới Phiếu Chi ở Sổ Quỹ
  createdAt        DateTime @default(now())

  user User @relation(fields: [userId], references: [id])
}
// Đừng quên cập nhật quan hệ ở User: payslips Payslip[]
```

## 3. Luồng "Chốt Lương" (Thanh toán Lương)

### Bước A: Xem trước (Draft Payslip)
Khi sếp bấm nút **"Thanh Toán Lương"** trên hồ sơ nhân sự, một Popup sẽ hiện ra tính toán sẵn:
- **Lương cứng**: Lấy từ `EmployeeProfile.baseSalary`.
- **Hoa hồng được duyệt**: Tổng `commissionAmount` của các `SalesOrder` đang có status = `APPROVED`.
- **Dư nợ tạm ứng**: Tổng (ADVANCE) - Tổng (REFUND) từ bảng `EmployeeTransaction`.
- **Số tiền cấn trừ (Advance Deduction)**: Cho phép sếp *nhập tay* (mặc định điền max số nợ). Sếp có thể trừ lùi (nợ 5 triệu, tháng này chỉ trừ 2 triệu, cho nợ tiếp 3 triệu).
- **Thực lãnh (Net Pay)** = Lương cứng + Hoa hồng - Số tiền cấn trừ.
- **Nguồn tiền**: Dropdown chọn Quỹ/Tài khoản để xuất tiền trả lương.

### Bước B: Thực thi (Database Transaction 3 Mũi Tên)
Khi bấm "Xác nhận Thanh toán", Server Action `finalizePayrollAction` sẽ làm 4 việc trong 1 transaction:
1. **Lưu Phiếu lương (`Payslip`)**: Lưu lại mọi con số ở trên để làm lịch sử.
2. **Sinh Phiếu Chi Quỹ (`Transaction`)**: Tạo 1 phiếu loại `EXPENSE` vào Quỹ công ty với số tiền = `Net Pay`. Ghi chú: "Trả lương tháng X cho nhân viên Y".
3. **Cấn trừ Nợ Tạm ứng (`EmployeeTransaction`)**: Tạo 1 bản ghi loại `REFUND` (Hoàn ứng) với số tiền = `Advance Deduction` để làm giảm dư nợ của nhân viên.
4. **Khóa Hoa hồng**: Đổi tất cả `SalesOrder` của nhân viên đó từ `APPROVED` sang `PAID`. (Để tháng sau không bị lấy ra tính lương lại).

## 4. UI/UX
- Ở màn hình "Hồ sơ tài chính nhân viên", thêm tab **"Lịch sử Lương" (Payslips)** để sếp/nhân viên xem lại các tháng trước.
- Nút "Thanh toán lương" to và rõ ràng. Khóa nút này nếu Dư nợ < 0 hoặc không có Hoa hồng/Lương để tránh bấm nhầm.

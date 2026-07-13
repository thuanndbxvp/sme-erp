# PLAN: Module Nhân Sự & Tiền Lương (HR & Payroll)
**Document Type**: Implementation Plan
**Author**: Tier 1 Architect
**Status**: APPROVED

## 1. Tầm nhìn & Kiến trúc
Module HR-Payroll của SME-ERP được thiết kế theo tư tưởng "Linh hoạt tối đa - Quyền lực thuộc về Sếp". Module này hoạt động độc lập và không can thiệp vào luồng Bán hàng/Sổ quỹ cơ bản, cho phép doanh nghiệp áp dụng bất cứ lúc nào.

**3 Trụ cột chính:**
1. **Hồ sơ tài chính nhân viên (`EmployeeProfile`)**: Lưu Lương cứng, STK Ngân hàng.
2. **Cơ chế Hoa hồng Mềm dẻo**: Gắn cứng vào Đơn hàng (`SalesOrder.commissionAmount`), nhưng sếp có quyền Duyệt (Approve) thủ công độc lập với trạng thái thanh toán của Đơn.
3. **Quản lý Tạm ứng (Salary Advance)**: Nút "Ứng Lương" sinh ra 1 phiếu Chi trong sổ quỹ đồng thời tự động ghi Nợ nhân viên (`EmployeeTransaction`).

---

## 2. Thay đổi Database Schema (`schema.prisma`)

### A. Employee Profile
```prisma
model EmployeeProfile {
  id          String   @id @default(cuid())
  userId      String   @unique
  baseSalary  Decimal  @default(0) @db.Decimal(15, 2)
  bankName    String?
  bankAccount String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
// Nhớ thêm employeeProfile EmployeeProfile? vào model User
```

### B. Mở rộng SalesOrder (Hoa hồng)
Thêm 2 trường vào `SalesOrder`:
```prisma
  commissionAmount Decimal @default(0) @db.Decimal(15, 2)
  commissionStatus String  @default("PENDING") // PENDING | APPROVED | PAID
```

### C. Mở rộng Enum / Quyền (Seed)
Thêm các quyền vào `seed.ts`:
- `hr.view`: Xem danh sách nhân viên & bảng lương.
- `hr.manage`: Cấp tạm ứng, chỉnh sửa lương cứng.
- `commission.approve`: Duyệt hoa hồng đơn hàng.

---

## 3. Các Luồng Nghiệp vụ Cốt Lõi (Core Workflows)

### Luồng 1: Thiết lập Đơn hàng & Hoa hồng
- Khi tạo/sửa `SalesOrder`, UI cho phép nhập tay `commissionAmount` (mặc định = 0).
- Trạng thái mặc định là `PENDING`.

### Luồng 2: Ứng Lương (Advance Salary)
- Nút **"Cấp Tạm Ứng"** trên UI (nằm ở trang quản lý Sổ quỹ hoặc trang Hồ sơ nhân sự).
- Khi bấm: Chọn Nhân viên, Chọn Quỹ nguồn (Cash/Bank), Nhập số tiền.
- Backend chạy Prisma Transaction:
  1. Xóa tiền từ Két: Tạo `Transaction` loại `EXPENSE`, ghi chú "Tạm ứng lương...".
  2. Ghi nợ nhân viên: Tạo `EmployeeTransaction` loại `ADVANCE`, `amount` tương ứng.

### Luồng 3: Trang Hồ sơ Tài chính Nhân viên (Dashboard)
- Giao diện `app/(dashboard)/hr/employees/[id]`.
- **Hiển thị:**
  - Thông tin cơ bản & Lương cứng.
  - Khối 1: Danh sách các khoản đã ứng (`EmployeeTransaction`).
  - Khối 2: Danh sách Hoa hồng chờ duyệt (`SalesOrders` có `commissionAmount > 0` và status `PENDING`). Có nút **Duyệt (Approve)** cho Admin.

### Luồng 4: Chốt lương cuối tháng (Thanh toán Lương)
- Kế toán bấm nút **"Thanh toán lương"** (Thực lãnh = Lương cứng + Hoa hồng APPROVED - Tạm ứng ADVANCE).
- Hệ thống sẽ chạy Database Transaction xử lý 3 việc cùng lúc:
  1. **Sinh Phiếu Chi Sổ Quỹ**: Tự động tạo 1 `Transaction` (EXPENSE) với số tiền đúng bằng mức [Thực lãnh] để trừ tiền từ Két/Ngân hàng công ty.
  2. **Tất toán Nợ Nhân Sự**: Tạo 1 `EmployeeTransaction` loại `PAYROLL_PAYOUT` để reset cục tiền Tạm ứng và chốt sổ kỳ lương.
  3. **Khóa Hoa Hồng**: Chuyển trạng thái các đơn hàng từ `APPROVED` sang `PAID` (Đã thanh toán HH), tránh việc tháng sau bị cộng dồn nhầm.
- *(Tính năng Chốt lương này sẽ được phát triển ở Phase 2, hiện tại Phase 1 tập trung xây dựng móng Database, Ứng lương và Duyệt Hoa hồng).*

---
*Kế hoạch này sẽ được Tầng 2 triển khai ngay lập tức, trọng tâm vào Database, tính năng Ứng Lương và Giao diện Quản trị Nhân sự.*

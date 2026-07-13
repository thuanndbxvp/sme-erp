# MSEW: Fix Broken Access Control on Dashboard Pages

## 1. Yêu cầu chung cho Tier 2
Tại 5 file `page.tsx` được liệt kê dưới đây, bạn cần thực hiện 2 thay đổi nhỏ:
1. Đảm bảo import: `import { requirePermission } from "@/lib/authorize";`
2. Gọi hàm check quyền ngay dưới dòng lấy session:
   ```typescript
   const session = await auth();
   await requirePermission(session?.user?.id, "MÃ_QUYỀN_TƯƠNG_ỨNG");
   ```

## 2. Danh sách file và Mã quyền tương ứng

### 2.1 Quản lý Dòng tiền (Cashflow)
- **File:** `src/app/(dashboard)/cashflow/page.tsx`
- **Mã quyền:** `cashflow.view`
- **Code mẫu:** `await requirePermission(session?.user?.id, "cashflow.view");`

### 2.2 Quản lý Công nợ (Debts)
- **File:** `src/app/(dashboard)/debts/page.tsx`
- **Mã quyền:** `debt.view`
- **Code mẫu:** `await requirePermission(session?.user?.id, "debt.view");`

### 2.3 Quản lý Tài khoản (Users)
- **File:** `src/app/(dashboard)/users/page.tsx`
- **Mã quyền:** `system.admin`
- **Code mẫu:** `await requirePermission(session?.user?.id, "system.admin");`

### 2.4 Báo cáo (Reports)
- **File:** `src/app/(dashboard)/reports/page.tsx`
- **Mã quyền:** `report.view`
- **Code mẫu:** `await requirePermission(session?.user?.id, "report.view");`

### 2.5 Quản lý Đơn hàng (Orders)
- **File:** `src/app/(dashboard)/orders/page.tsx`
- **Mã quyền:** `order.view`
- **Code mẫu:** `await requirePermission(session?.user?.id, "order.view");`

## 3. Xác nhận kết quả
Sau khi áp dụng, hãy đăng nhập thử bằng tài khoản `sale.test@viettung.online` và cố tình truy cập vào URL `/cashflow`. Trình duyệt phải báo lỗi chặn truy cập thay vì hiển thị dữ liệu thật.

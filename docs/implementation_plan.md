# Nâng cấp Mua hàng & Dropship: Tách Nhà Cung Cấp theo Sản phẩm

Tính năng Mua hàng (Nhập kho) và Dropship hiện tại ràng buộc 1 Đơn hàng với 1 Nhà cung cấp (NCC). Việc cho phép người dùng chọn NCC riêng cho từng sản phẩm đòi hỏi hệ thống phải tự động tách (split) các sản phẩm thành nhiều Đơn mua hàng (Purchase Order) khác nhau dưới nền (backend), tương ứng với từng NCC. Việc này đảm bảo công nợ và dòng tiền được ghi nhận chính xác cho từng NCC.

## User Review Required

> [!WARNING]
> **Xử lý Thanh toán một phần (PARTIAL) cho Đơn nhiều NCC**
> Khi tạo đơn có nhiều NCC, nếu người dùng chọn "Đã thanh toán đủ", hệ thống sẽ tự động tạo các phiếu chi cho TẤT CẢ các NCC.
> Tuy nhiên, nếu chọn "Trả một phần", việc chia số tiền tổng cho từng NCC trên giao diện hiện tại sẽ phức tạp.
> **Đề xuất**: Nếu đơn có >1 NCC, hệ thống sẽ tự động vô hiệu hóa (disabled) tùy chọn "Trả một phần" ở phần đầu vào. Người dùng sẽ phải chọn "Chưa thanh toán", sau đó vào phân hệ **Công nợ** để thanh toán riêng lẻ cho từng NCC (việc này đúng với nghiệp vụ kế toán vì bạn không thể trả một cục tiền lẫn lộn cho nhiều NCC). 
> 
> *Bạn có đồng ý với hướng xử lý vô hiệu hóa "Trả một phần" khi có >1 NCC không?*

> [!IMPORTANT]
> **Thay đổi Cấu trúc Dữ liệu (Database Schema)**
> Chức năng Dropship cần được thiết kế lại ở cấp độ CSDL:
> - Bảng `SalesOrder`: Xóa trường `linkedPurchaseOrderId` (hiện tại chỉ kết nối 1-1).
> - Bảng `PurchaseOrder`: Thêm trường `linkedSalesOrderId` (để 1 Đơn bán Dropship có thể kết nối với NHIỀU Đơn mua).

## Proposed Changes

### Database Schema (Prisma)
Sửa đổi quan hệ giữa SalesOrder và PurchaseOrder để hỗ trợ 1-N.

#### [MODIFY] prisma/schema.prisma
- Xóa `linkedPurchaseOrderId` trong `SalesOrder`.
- Thêm `linkedSalesOrderId String?` vào `PurchaseOrder`.
- Thêm relation `linkedSalesOrder SalesOrder? @relation(fields: [linkedSalesOrderId], references: [id])` vào `PurchaseOrder`.

### Frontend: Giao diện tạo đơn (UI)
Cập nhật form để chuyển dropdown chọn NCC từ mức Đơn hàng xuống mức Dòng sản phẩm.

#### [MODIFY] src/app/(dashboard)/orders/new/UnifiedOrderForm.tsx
- Loại bỏ trường chọn `supplierId` ở khối "Thông tin Mua hàng (Đầu vào)".
- Thêm cột "Nhà cung cấp" vào bảng `Sản phẩm` (Items Table). Mỗi dòng (ItemRow) sẽ có state `supplierId`.
- Xử lý mảng `suppliers` truyền vào để hiển thị trong `<select>` ở mỗi dòng sản phẩm.
- Khi submit, payload `items` gửi xuống server sẽ bao gồm `supplierId` của từng món.
- Logic kiểm tra thanh toán: Nếu có nhiều NCC khác nhau trong danh sách `items`, block chức năng "PARTIAL" trong khối "Thanh toán (Mua)".

### Backend: Xử lý Tách đơn & Dòng tiền
Khi nhận payload từ UI, hệ thống gom nhóm các sản phẩm theo NCC và tạo nhiều PO.

#### [MODIFY] src/app/actions/order-actions.ts
- `createUnifiedOrder`: 
  - Đọc `supplierId` từ từng item thay vì từ form chung. Validate bắt buộc phải chọn NCC.
  - Nhóm `processedItems` theo `supplierId`.
  - **Với IMPORT**: Vòng lặp qua từng nhóm NCC -> tạo nhiều `PurchaseOrder` & `Invoice`. Nếu `purchaseStatus == PAID`, vòng lặp qua từng hóa đơn để tạo nhiều `Payment` độc lập, đảm bảo dòng tiền/công nợ chia chính xác theo NCC.
  - **Với DROPSHIP**: Tạo 1 `SalesOrder`. Sau đó vòng lặp qua các nhóm NCC để tạo nhiều `PurchaseOrder` (gắn `linkedSalesOrderId = so.id`). Tương tự, nếu thanh toán đủ, tạo nhiều `Payment` cho các NCC.

#### [MODIFY] src/services/order-orchestrator.service.ts
- `createDropshipOrder`: Cập nhật logic để nhận `items` (bao gồm `supplierId`), nhóm theo `supplierId` và gọi `PurchaseOrderService.createInTx` nhiều lần trong 1 transaction. Trả về list `purchaseOrders` thay vì 1 PO.
- `deliverSalesOrder`: Cập nhật logic khi giao đơn Dropship -> tìm TẤT CẢ các `PurchaseOrder` có `linkedSalesOrderId = salesOrderId` để gọi `receivePurchaseOrderInternal`.
- `cancelSalesOrder`: Khi hủy đơn bán Dropship, tìm TẤT CẢ các `PurchaseOrder` liên quan để gọi hàm hủy.
- Cập nhật lại các câu query raw SQL (VD: loại bỏ `linkedPurchaseOrderId` ở `SELECT`) thành query phù hợp với schema mới.

## Verification Plan

### Automated Tests
- Chạy `npm run typecheck` để đảm bảo code logic không bị lỗi do thay đổi schema (những file sử dụng `linkedPurchaseOrderId` sẽ báo lỗi và cần được sửa).
- Chạy `npx prisma format` và `npx prisma db push` (hoặc `migrate`) để apply schema mới.

### Manual Verification
1. **Kiểm tra UI**: Mở form "Nhập kho" và "Dropship", thêm 2 sản phẩm và chọn 2 NCC khác nhau tại mỗi dòng sản phẩm.
2. **Tạo đơn Nhập kho**: Tạo đơn thành công, kiểm tra trong trang Đơn hàng xem có 2 Đơn mua (PO) tương ứng được sinh ra hay không.
3. **Dòng tiền & Công nợ**: Chọn "Đã thanh toán đủ" lúc tạo đơn, sau đó vào Sổ quỹ (Cashflow) và Công nợ (Debts) kiểm tra xem có đúng 2 phiếu chi tiền cho 2 NCC với số tiền chính xác được sinh ra không.
4. **Dropship**: Tạo đơn Dropship 2 NCC, sau đó vào Bấm "Giao hàng" cho đơn bán, kiểm tra xem cả 2 PO đều tự động chuyển sang "RECEIVED" và kho có ghi nhận In/Out ảo đúng không.

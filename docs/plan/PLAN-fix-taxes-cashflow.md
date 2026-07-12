# Plan: Fix Order Taxes and Cashflow Accounting

## 1. Mục tiêu
1. Đảm bảo tiền trả NCC (Mua hàng) và tiền thu KH (Bán hàng) trên form tạo đơn tự động cộng thêm thuế (Thuế mua toàn đơn / Thuế bán toàn đơn).
2. Khi thực hiện thanh toán ngay trên form (hoặc bất kỳ chỗ nào gọi qua `PaymentService`), số tiền thu/chi phải được hạch toán minh bạch vào `cashFlowGroup = "OPERATIONAL"` (Dòng tiền Kinh doanh).
3. Đẩy đúng số thuế `taxAmount` và `purchaseTaxAmount` từ Client xuống các Service tạo PO/SO thay vì fix cứng là `"0"`.

## 2. Các thay đổi kỹ thuật
- **`src/lib/validations/order.ts`**: Bổ sung `purchaseTaxAmount: moneySchema.default("0")` vào schema của `dropshipItemInput` để Zod chấp nhận truyền thuế mua hàng.
- **`src/app/(dashboard)/orders/new/UnifiedOrderForm.tsx`**: 
  - Sửa công thức tính `totalBuy` và `totalSell` để bao gồm `taxRate` và `purchaseTaxRate`.
- **`src/app/actions/order-actions.ts`**:
  - Tại `createUnifiedOrder`, map mảng `items` để tính toán chính xác `taxAmount` (thuế bán) và `purchaseTaxAmount` (thuế mua) trước khi truyền vào Orchestrator.
  - Bổ sung `cashFlowGroup: "OPERATIONAL"` vào tất cả các lệnh gọi `PaymentService.recordPayment`.
- **`src/services/order-orchestrator.service.ts`**:
  - Sửa dòng map item của `PurchaseOrderService.createInTx` trong dropship từ `taxAmount: "0"` thành `taxAmount: it.purchaseTaxAmount`.
- **`src/services/payment.service.ts`**:
  - Thêm thuộc tính `cashFlowGroup` vào interface `RecordPaymentInput`.
  - Pass giá trị này xuống `TransactionService.recordTransaction` để đảm bảo hệ thống lưu đúng nhóm dòng tiền.

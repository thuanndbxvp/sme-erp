# Micro-Step Execution Workflow: Fix Taxes and Cashflow Accounting

## Bước 1: Sửa Schema Zod cho Dropship
- **Target File:** `src/lib/validations/order.ts`
- **Action 1.1:** Tìm khai báo `export const dropshipItemInput = salesOrderItemInput.extend({` (khoảng dòng 68).
- **Action 1.2:** Thay thế block đó bằng:
```typescript
export const dropshipItemInput = salesOrderItemInput.extend({
  buyPrice: moneySchema, // giá nhập NCC cho dòng này (tạo PO)
  purchaseTaxAmount: moneySchema.default("0"),
});
```

## Bước 2: Cập nhật Payment Service hỗ trợ CashFlowGroup
- **Target File:** `src/services/payment.service.ts`
- **Action 2.1:** Thêm thuộc tính `cashFlowGroup?: CashFlowGroupValue;` vào `export interface RecordPaymentInput` (dòng 42). Import `CashFlowGroupValue` từ `@/domain/constants` nếu chưa có. Thay thế import `PaymentDirectionValue` ở dòng 12 thành:
```typescript
import type { PaymentDirectionValue, CashFlowGroupValue } from "@/domain/constants";
```
- **Action 2.2:** Tìm hàm `static async recordPayment(input: RecordPaymentInput...` và sửa đoạn gọi `await TransactionService.recordTransaction(tx, {` (khoảng dòng 79). Cập nhật thuộc tính `cashFlowGroup` vào object:
```typescript
        await TransactionService.recordTransaction(tx, {
          type: txType,
          amount: input.amount,
          accountId: input.accountId,
          customerId: input.customerId ?? null,
          supplierId: input.supplierId ?? null,
          cashFlowGroup: input.cashFlowGroup,
          description: input.description ?? "Thanh toán",
        });
```

## Bước 3: Đảm bảo Orchestrator nhận thuế mua hàng
- **Target File:** `src/services/order-orchestrator.service.ts`
- **Action 3.1:** Tìm hàm `createDropshipOrder`. Ở đoạn tạo `PurchaseOrderService.createInTx` (khoảng dòng 63), sửa đoạn `taxAmount: "0"` thành `taxAmount: (it as any).purchaseTaxAmount ?? "0"`:
```typescript
        items: input.items.map((it) => ({ productId: it.productId, productName: it.productName, unit: it.unit, qty: it.qty, buyPrice: (it as any).buyPrice, taxAmount: (it as any).purchaseTaxAmount ?? "0" })),
```

## Bước 4: Sửa Backend Actions để tính thuế và truyền cashFlowGroup
- **Target File:** `src/app/actions/order-actions.ts`
- **Action 4.1:** Tìm hàm `createUnifiedOrder`. Sửa kiểu `OrderItemInput` (dòng 172) để bổ sung `purchaseTaxAmount`.
```typescript
interface OrderItemInput { productId?: string; productName: string; unit: string; qty: number; buyPrice: string; sellPrice: string; baseCost: string; taxAmount: string; purchaseTaxAmount?: string; taxRate?: number; purchaseTaxRate?: number }
```
- **Action 4.2:** Thay thế toàn bộ đoạn map `items` trong `createUnifiedOrder` cho IMPORT, WAREHOUSE, DROPSHIP. (Khoảng dòng 194, 221, 238). Hãy parse lại logic này để lấy thuế từ rate. (Chú ý cần đổi `items: items.map(...)` thành đoạn tính toán thuế):
Thay tất cả các đoạn khai báo mảng `items` trong các lệnh gọi OrderOrchestrator bằng logic sau (dùng chung 1 biến trước khi truyền cho gọn):
Trước khối `if (mode === "IMPORT")` (dòng 185), khai báo:
```typescript
    const processedItems = items.map((it: OrderItemInput) => {
      const sellBase = Number(String(it.sellPrice).replace(/\D/g, "")) * it.qty;
      const sellTax = sellBase * (it.taxRate || 0) / 100;
      const buyBase = Number(String(it.buyPrice).replace(/\D/g, "")) * it.qty;
      const buyTax = buyBase * (it.purchaseTaxRate || 0) / 100;
      return { 
        ...it,
        qty: Number(it.qty) || 1,
        buyPrice: String(Number(String(it.buyPrice).replace(/\D/g, "")) || 0),
        sellPrice: String(Number(String(it.sellPrice).replace(/\D/g, "")) || 0),
        baseCost: String(Number(String(it.baseCost).replace(/\D/g, "")) || Number(String(it.buyPrice).replace(/\D/g, "")) || 0),
        taxAmount: String(sellTax),
        purchaseTaxAmount: String(buyTax)
      };
    });
```
Sau đó thay thế `items: items.map(...)` trong 3 chế độ IMPORT, WAREHOUSE, DROPSHIP bằng `items: processedItems`.
- **Action 4.3:** Tìm tất cả các chỗ gọi `await PaymentService.recordPayment({` trong file này (khoảng 4 chỗ) và thêm field `cashFlowGroup: "OPERATIONAL",` vào cấu trúc object truyền vào.

## Bước 5: Cập nhật Frontend UnifiedOrderForm
- **Target File:** `src/app/(dashboard)/orders/new/UnifiedOrderForm.tsx`
- **Action 5.1:** Tìm biến `totalBuy` và `totalSell` (dòng 120, 121) và sửa công thức để cộng thêm Thuế theo Rate:
```tsx
  const totalBuy = items.reduce((s, it) => {
    const base = (Number(String(it.buyPrice).replace(/\D/g, "")) || 0) * (Number(it.qty) || 0);
    const tax = base * (Number(it.purchaseTaxRate) || 0) / 100;
    return s + base + tax;
  }, 0);

  const totalSell = items.reduce((s, it) => {
    const base = (Number(String(it.sellPrice).replace(/\D/g, "")) || 0) * (Number(it.qty) || 0);
    const tax = base * (Number(it.taxRate) || 0) / 100;
    return s + base + tax;
  }, 0);
```

Sau khi hoàn thành, dùng lệnh `/audit` để báo cáo thành quả.

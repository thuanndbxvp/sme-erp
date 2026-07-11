# MSEW: Micro-Step Execution Workflow (Refactor Core Services)

> **Gửi Tầng 2 (Coder):** Làm cẩn thận, đây là Core Services liên quan đến Tiền! Đừng làm hỏng giao dịch (Transaction) của Database.

## Bước 1: Tích hợp Guard vào Transaction Service
Mở file `src/services/transaction.service.ts`. 
Ở đầu file, import Helper:
```typescript
import { AuditAndSecurityHelper } from "@/lib/audit";
```

Trong hàm `static async recordTransaction(tx, input)`, thêm đoạn Guard này vào **ngay trên cùng** (trước cả khi check amount):
```typescript
    // [SECURITY] Chặn sửa/tạo giao dịch vào kỳ đã khóa sổ
    await AuditAndSecurityHelper.assertNotPeriodLocked(new Date());
```

Ngay trước lệnh `return tx.transaction.create(...)`, thêm dòng Audit (Fire & Forget):
```typescript
    AuditAndSecurityHelper.logAction({
      action: "CREATE",
      entityType: "TRANSACTION",
      entityId: "new", // Vì create chưa có ID, hoặc lưu lại response
      metadata: { type: input.type, amount: input.amount, accountId: input.accountId }
    });
```

## Bước 2: Tích hợp Guard vào Invoice Service
Tương tự, mở `src/services/invoice.service.ts` (nếu có hàm tạo/sửa hóa đơn):
Import Helper:
```typescript
import { AuditAndSecurityHelper } from "@/lib/audit";
```

Trong các hàm như `createInvoice`, `updateInvoice`, chèn Guard chặn ngày:
```typescript
    // [SECURITY] Chặn sửa/tạo hóa đơn vào kỳ đã khóa sổ
    await AuditAndSecurityHelper.assertNotPeriodLocked(new Date());
```

## Bước 3: Phân rã Order Orchestrator (Khởi tạo Cấu trúc)
Mở `src/services/order-orchestrator.service.ts`. Hãy rà soát toàn bộ code. Nếu thấy các khối logic xử lý trừ kho đang dài hơn 50 dòng, hãy cắt nó ra một file mới: `src/services/order-fulfillment.service.ts` và export class `OrderFulfillmentService`.
Làm tương tự với phần tạo Hóa đơn (cắt ra `order-billing.service.ts`). Trong file orchestrator hiện tại, chỉ giữ lại nhiệm vụ "Điều phối" (Gọi hàm từ Fulfillment và Billing).

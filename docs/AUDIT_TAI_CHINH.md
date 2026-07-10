# Báo cáo Audit Tài Chính Toàn Diện — SME ERP

> **Ngày audit:** 2026-07-11
> **Phạm vi:** Dòng tiền, Đơn hàng, Hóa đơn, Công nợ
> **Files đã audit:**
> - `src/services/invoice.service.ts`
> - `src/services/payment.service.ts`
> - `src/services/transaction.service.ts`
> - `src/services/order-orchestrator.service.ts`
> - `src/services/sales-order.service.ts`
> - `src/services/purchase-order.service.ts`
> - `src/services/reconciliation.service.ts`
> - `src/services/report.service.ts`
> - `src/app/actions/order-actions.ts`

---

## 🔴 CRITICAL — 3 lỗ hổng phải sửa ngay

---

### CRITICAL #1: Hủy đơn đã thanh toán → TIỀN BỊ MẤT (không hoàn tiền)

**File:** `src/services/order-orchestrator.service.ts:342-346` + `src/services/invoice.service.ts:105-122`

**Mô tả:** Khi hủy đơn đã DELIVERED và đã được KH thanh toán, `InvoiceService.cancel()` đặt `paidAmount=0, balanceDue=0` nhưng **KHÔNG** tạo Transaction ngược dấu để hoàn tiền về Account. Hậu quả:

- Số dư quỹ (`Account.balance`) đã tăng do nhận tiền → **không bị đảo ngược**
- Invoice báo `paidAmount=0` → công nợ **biến mất**
- Tiền trong két **ảo** — sổ quỹ và công nợ **lệch nhau vĩnh viễn**

**Dòng code hiện tại:**
```typescript
// invoice.service.ts:105-109 — Hủy invoice, reset paidAmount về 0
static async cancel(tx: TxClient, invoiceId: string) {
  const inv = await tx.invoice.update({
    where: { id: invoiceId },
    data: { status: INVOICE_STATUS.CANCELLED, paidAmount: "0", balanceDue: "0" },
  });
  // ❌ KHÔNG tạo Transaction hoàn tiền (EXPENSE cho AR, INCOME cho AP)
```

**Fix đề xuất:**
```typescript
// Trong InvoiceService.cancel — thêm hoàn tiền nếu đã có thanh toán
static async cancel(tx: TxClient, invoiceId: string) {
  const inv = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } });

  // Nếu đã có thanh toán → hoàn tiền về account
  if (Money.of(inv.paidAmount.toString()).isPositive()) {
    // Tìm các PaymentApplication liên quan
    const apps = await tx.paymentApplication.findMany({
      where: { invoiceId },
      include: { payment: true },
    });
    for (const app of apps) {
      // Tạo Transaction ngược dấu
      const reverseType = app.payment.direction === "IN" ? "EXPENSE" : "INCOME";
      await tx.$executeRawUnsafe(
        `INSERT INTO "Transaction" ("id", "type", "amount", "accountId", "description", "customerId", "supplierId")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)`,
        reverseType,
        app.appliedAmount.toString(),
        app.payment.accountId,
        `Hoàn tiền hủy hóa đơn ${inv.invoiceNumber}`,
        inv.customerId,
        inv.supplierId
      );
    }
  }

  // Sau đó mới cancel invoice
  await tx.invoice.update({
    where: { id: invoiceId },
    data: { status: INVOICE_STATUS.CANCELLED, paidAmount: "0", balanceDue: "0" },
  });

  // Derive order.paymentStatus → UNPAID (không lưu song song 2 nguồn)
  if (inv.salesOrderId) {
    await tx.salesOrder.update({
      where: { id: inv.salesOrderId },
      data: { paymentStatus: "UNPAID" },
    });
  } else if (inv.purchaseOrderId) {
    await tx.purchaseOrder.update({
      where: { id: inv.purchaseOrderId },
      data: { paymentStatus: "UNPAID" },
    });
  }
}
```

---

### CRITICAL #2: IMPORT (Nhập kho) KHÔNG tạo AP Invoice → mất công nợ NCC

**File:** `src/app/actions/order-actions.ts` — hàm `createUnifiedOrder`, mode `IMPORT`

**Mô tả:** Khi tạo đơn nhập kho (IMPORT), code gọi `PurchaseOrderService.create()` nhưng **quên** gọi `InvoiceService.createFromPurchaseOrder()`. Hậu quả:

- PO tồn tại nhưng **không có AP Invoice**
- Công nợ phải trả NCC **không được ghi nhận**
- Trang `/debts` không hiển thị khoản nợ này
- Sau này có trả tiền NCC cũng không có invoice để apply
- Nếu có `purchasePayment`, `PaymentService.recordPayment` gọi với `applications: []` → sẽ throw "Cần ít nhất 1 hóa đơn"

**Dòng code hiện tại:**
```typescript
// order-actions.ts — IMPORT mode
if (mode === "IMPORT") {
  const po = await PurchaseOrderService.create({
    supplierId: formData.get("supplierId") as string,
    warehouseId: formData.get("warehouseId") as string || undefined,
    orderDate: ...,
    items: items.map(...),
  }, { userId: session?.user?.id, now: new Date(), random: Math.random() });
  // ❌ THIẾU: không tạo AP Invoice cho PO

  if (purchasePayment) {
    // ❌ Gọi PaymentService.recordPayment nhưng không có invoice
    // → sẽ throw "Cần ít nhất 1 hóa đơn để áp thanh toán"
  }
}
```

**Fix đề xuất:**
```typescript
if (mode === "IMPORT") {
  // Phải dùng $transaction để PO + Invoice + Payment atomic
  const po = await prisma.$transaction(async (tx) => {
    const po = await PurchaseOrderService.createInTx(tx, {
      supplierId: formData.get("supplierId") as string,
      warehouseId: formData.get("warehouseId") as string || undefined,
      orderDate: ...,
      items: items.map(...),
    }, { userId: session?.user?.id, now: new Date(), random: Math.random() });

    // Tạo AP Invoice
    await InvoiceService.createFromPurchaseOrder(tx, {
      id: po.id,
      supplierId: po.supplierId,
      totalAmount: po.totalAmount.toString(),
    });

    return po;
  });

  if (purchasePayment) {
    const inv = await prisma.invoice.findUnique({ where: { purchaseOrderId: po.id } });
    if (inv) {
      await PaymentService.recordPayment({
        direction: PAYMENT_DIRECTION.OUT,
        amount: purchasePayment.paidAmount,
        accountId: purchasePayment.accountId,
        supplierId: po.supplierId,
        applications: [{ invoiceId: inv.id, appliedAmount: purchasePayment.paidAmount }],
      });
    }
  }
}
```

---

### CRITICAL #3: THIẾU cơ chế Tạm ứng / Đặt cọc (Advance Payment / Deposit)

**File:** `src/services/payment.service.ts`

**Mô tả:** Hệ thống hiện **bắt buộc** mọi Payment phải gắn với 1 Invoice (`PaymentService.recordPayment` yêu cầu `applications.length > 0`). Điều này có nghĩa:

- KH đặt cọc 50% → không thể ghi nhận vì chưa có đơn hàng/hóa đơn
- Trả trước NCC 30% → không thể ghi nhận vì chưa có PO/Invoice
- Khoản tạm ứng này là **nghĩa vụ tài chính thật** nhưng không được tracking
- Khi hóa đơn được sinh ra sau đó, không có cơ chế cấn trừ tạm ứng vào hóa đơn

**Fix 1:** Thêm method `recordAdvancePayment` vào PaymentService:
```typescript
// payment.service.ts — method mới
static async recordAdvancePayment(input: {
  direction: PaymentDirectionValue;
  amount: string;
  accountId: string;
  customerId?: string | null;
  supplierId?: string | null;
  description?: string | null;
}, prisma: PrismaClient = defaultPrisma) {
  if (Money.of(input.amount).lte(0)) {
    throw new ValidationError("Số tiền phải lớn hơn 0");
  }
  return prisma.$transaction(async (tx) => {
    // 1) Ghi Transaction cập nhật balance (C2)
    await TransactionService.recordTransaction(tx, {
      type: input.direction === "IN" ? "INCOME" : "EXPENSE",
      amount: input.amount,
      accountId: input.accountId,
      customerId: input.customerId ?? null,
      supplierId: input.supplierId ?? null,
      description: input.description ?? "Tạm ứng / Đặt cọc",
    });
    // 2) Tạo Payment record (KHÔNG gắn invoice — chưa có)
    return tx.payment.create({
      data: {
        direction: input.direction,
        amount: Money.of(input.amount).toDecimalString(),
        accountId: input.accountId,
        customerId: input.customerId ?? null,
        supplierId: input.supplierId ?? null,
        description: input.description ?? "Tạm ứng / Đặt cọc",
      },
    });
  }, { maxWait: 15_000, timeout: 20_000 });
}
```

**Fix 2:** Thêm method `applyAdvanceToInvoice` để cấn trừ tạm ứng vào hóa đơn khi hóa đơn được tạo:
```typescript
// invoice.service.ts — method mới
static async applyAdvanceToInvoice(
  tx: TxClient,
  invoiceId: string,
  customerId?: string,
  supplierId?: string,
) {
  // Tìm các Payment chưa được áp dụng (không có PaymentApplication)
  const unapplied = await tx.payment.findMany({
    where: {
      customerId: customerId ?? null,
      supplierId: supplierId ?? null,
      applications: { none: {} },
    },
  });

  for (const payment of unapplied) {
    const remaining = Money.of(payment.amount.toString());
    // Áp toàn bộ vào invoice
    await InvoiceService.applyPayment(tx, invoiceId, remaining.toDecimalString());
    await tx.paymentApplication.create({
      data: {
        paymentId: payment.id,
        invoiceId,
        appliedAmount: remaining.toDecimalString(),
      },
    });
  }
}
```

---

## 🟡 MODERATE — 2 vấn đề nên sửa

---

### MODERATE #4: `InvoiceService.cancel` KHÔNG có FOR UPDATE

**File:** `src/services/invoice.service.ts:105`

**Mô tả:** `applyPayment()` có `FOR UPDATE` để chống race condition, nhưng `cancel()` thì không. Nếu cancel và payment xảy ra đồng thời (trong 2 transaction khác nhau), kết quả không đoán trước được:
- Payment apply thành công → paidAmount tăng
- Cancel đồng thời → reset paidAmount về 0
- Cả 2 transaction đều commit → paidAmount bị ghi đè sai

**Fix:**
```typescript
static async cancel(tx: TxClient, invoiceId: string) {
  // Lock invoice trước khi cancel
  await tx.$queryRaw`SELECT "id" FROM "Invoice" WHERE "id"=${invoiceId} FOR UPDATE`;
  const inv = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
  // ... phần còn lại giữ nguyên
}
```

---

### MODERATE #5: DROPSHIP delivery không đồng bộ PO status

**File:** `src/services/order-orchestrator.service.ts:154-221` (`deliverSalesOrder`)

**Mô tả:** Khi giao hàng dropship (SO → DELIVERED), hàng đi thẳng từ NCC tới KH. Linked PO vẫn ở trạng thái ORDERED. Trong thực tế dropship, PO nên được tự động chuyển RECEIVED vì hàng đã được NCC giao. Nếu không:
- Báo cáo công nợ AP có thể sai (chưa nhận hàng nhưng đã bán?)
- Không có inventory movement IN nào cho PO (dù là ảo)

**Fix:** Trong `deliverSalesOrder`, khi là DROPSHIP, tự động receive PO liên kết:
```typescript
// Trong deliverSalesOrder, sau khi xử lý items:
if (isDropship) {
  const so = await tx.salesOrder.findUniqueOrThrow({
    where: { id: salesOrderId },
    select: { linkedPurchaseOrderId: true },
  });
  if (so.linkedPurchaseOrderId) {
    // Nhận hàng dropship: ghi movement ảo IN cho PO
    await receivePurchaseOrderInternal(tx, so.linkedPurchaseOrderId, meta);
  }
}
```

---

## 🔵 INFO — 4 điểm cần lưu ý

| # | Vấn đề | File |
|---|---|---|
| 6 | `computePaymentStatus` trả về `PaymentStatusValue` nhưng được dùng cho cả Invoice (OPEN/PARTIAL/PAID) và Order (UNPAID/PARTIAL/PAID) — không đồng nhất kiểu dữ liệu | `src/domain/payment-status.ts` |
| 7 | `report.service.ts` P&L dùng `baseCost*qty` thay vì `profit` field đã chốt lúc giao — có thể lệch nếu profit được cập nhật sau | `src/services/report.service.ts` |
| 8 | `AuditLog` model có nhưng không được tự động ghi khi tạo/hủy đơn, thanh toán, thu/chi. Toàn bộ audit trail là rỗng | Toàn bộ service |
| 9 | `createUnifiedOrder` IMPORT gọi `PurchaseOrderService.create()` → method này tự mở `$transaction` riêng, không cùng tx với payment. Nếu payment fail, PO vẫn được tạo. Nên dùng `createInTx` hoặc gom chung 1 transaction | `src/app/actions/order-actions.ts` |

---

## Kiểm tra ACID & Race Condition

### Transaction Coverage

| Thao tác | Transaction? | FOR UPDATE? | An toàn? |
|---|---|---|---|
| Tạo đơn (WAREHOUSE) | ✅ 1 tx (SO + Invoice) | N/A (tạo mới) | ✅ |
| Tạo đơn (DROPSHIP) | ✅ 1 tx (PO + SO + 2 Invoices) | N/A | ✅ |
| Tạo đơn (IMPORT) | ❌ PO dùng tx riêng, payment tx riêng | N/A | 🔴 |
| Giao hàng (DELIVERED) | ✅ 1 tx (status + inventory) | ✅ SO row | ✅ |
| Nhận hàng (RECEIVED) | ✅ 1 tx | ✅ PO row | ✅ |
| Thanh toán (recordPayment) | ✅ 1 tx | ✅ Account + Invoice | ✅ |
| Hủy đơn (CANCELLED) | ✅ 1 tx | ✅ Order row | ✅ |
| Hủy Invoice (cancel) | ✅ trong tx của hủy đơn | ❌ Invoice row | 🟡 |
| Thu/Chi (recordTransaction) | ✅ 1 tx | ✅ Account | ✅ |

### Race Condition Analysis

| Scenario | Có bị race không? |
|---|---|
| 2 người cùng thanh toán 1 invoice | ✅ An toàn — `FOR UPDATE` trên Invoice row |
| 2 người cùng hủy 1 đơn | ✅ An toàn — `FOR UPDATE` trên Order row |
| Thanh toán + Hủy invoice đồng thời | 🟡 Có thể race — `cancel` thiếu `FOR UPDATE` |
| 2 người cùng giao 1 đơn | ✅ An toàn — `FOR UPDATE` + idempotent check |
| 2 người cùng ghi thu/chi 1 account | ✅ An toàn — `FOR UPDATE` trên Account row |

---

## Tổng kết

| Mức | Số lượng | Hành động |
|---|---|---|
| 🔴 CRITICAL | 3 | **Phải sửa ngay** — mất tiền, mất công nợ, thiếu tạm ứng |
| 🟡 MODERATE | 2 | Nên sửa — race condition, thiếu đồng bộ dropship |
| 🔵 INFO | 4 | Cân nhắc — consistency, audit trail, refactor |

---

## Checklist sửa lỗi

- [ ] CRITICAL #1: Thêm hoàn tiền vào `InvoiceService.cancel()`
- [ ] CRITICAL #2: Thêm `InvoiceService.createFromPurchaseOrder` vào IMPORT mode
- [ ] CRITICAL #3: Thêm `recordAdvancePayment` + `applyAdvanceToInvoice`
- [ ] MODERATE #4: Thêm `FOR UPDATE` vào `InvoiceService.cancel()`
- [ ] MODERATE #5: Tự động `receivePurchaseOrder` khi dropship delivery
- [ ] INFO #6-9: Đánh giá và xử lý sau

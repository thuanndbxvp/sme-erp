# MSEW: Fix Security Pentest Findings

## 1. Xóa Debug Actions (CRITICAL)
- **File:** `src/app/actions/debug-actions.ts`
- **Hành động:** Xóa file này bằng lệnh CLI (vd: `rm src/app/actions/debug-actions.ts`).

## 2. Sửa IDOR Edit Order Page (HIGH)
- **File:** `src/app/(dashboard)/orders/edit/[id]/page.tsx`
- **Hành động:** 
  - Import `auth` từ `@/lib/auth` và `requirePermission` từ `@/lib/authorize`.
  - Trong hàm component `EditOrderPage`, thêm 2 dòng:
    ```typescript
    const session = await auth();
    await requirePermission(session?.user?.id, "order.view");
    ```
    (Đặt ngay trước khối lệnh `if (!order) notFound();` hoặc đầu hàm).

## 3. Chống lặp (Idempotency) Opening Balances (HIGH)
- **File:** `src/app/api/system/opening-balances/route.ts`
- **Hành động:**
  - Import `NextResponse` nếu cần.
  - Ở đầu `prisma.$transaction`, query check flag:
    ```typescript
    const flag = await prisma.systemSetting.findUnique({ where: { key: "IS_OPENING_BALANCES_DONE" } });
    if (flag?.value === "true") {
      throw new Error("Số dư đầu kỳ đã được khởi tạo. Không thể thực hiện lại.");
    }
    ```
  - Ở cuối `prisma.$transaction`, cập nhật cờ:
    ```typescript
    await tx.systemSetting.upsert({
      where: { key: "IS_OPENING_BALANCES_DONE" },
      update: { value: "true" },
      create: { key: "IS_OPENING_BALANCES_DONE", value: "true", type: "SYSTEM" }
    });
    ```

## 4. Thêm CSP Headers (HIGH)
- **File:** `next.config.ts`
- **Hành động:** Trong hàm `headers()`, thêm cấu hình CSP:
  ```typescript
  {
    key: "Content-Security-Policy",
    value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.upstash.io; frame-ancestors 'none'; base-uri 'self'; form-action 'self';"
  }
  ```

## 5. Bổ sung Phân quyền Category (HIGH)
- **File:** `src/app/actions/admin-actions.ts`
- **Hành động:** Trong action `createTransactionCategory`:
  - Sửa `await auth();` thành:
    ```typescript
    const session = await auth();
    await requirePermission(session?.user?.id, "cashflow.category.manage");
    ```
  - Make sure import `requirePermission` (đã có ở trên đầu file).

# CHANGELOG EXEC: fix-broken-access-control

## Các thay đổi đã thực hiện

| # | File | Lines Changed | Permission | Status |
|---|------|---------------|------------|--------|
| 1 | `src/app/(dashboard)/cashflow/page.tsx` | +3, -0 | `cashflow.view` | DONE |
| 2 | `src/app/(dashboard)/debts/page.tsx` | +3, -0 | `debt.view` | DONE |
| 3 | `src/app/(dashboard)/users/page.tsx` | +3, -0 | `system.admin` | DONE |
| 4 | `src/app/(dashboard)/reports/page.tsx` | +3, -0 | `report.view` | DONE |
| 5 | `src/app/(dashboard)/orders/page.tsx` | +3, -0 | `order.view` | DONE |

## Chi tiết

Mỗi file đã thêm pattern chuẩn:
```typescript
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/authorize";

export default async function XxxPage(...) {
  const session = await auth();
  await requirePermission(session?.user?.id, "MÃ_QUYỀN");
  // ... existing code
}
```

## Tác động
- 🔴 CRITICAL #2.1 (cashflow): ĐÃ FIX
- 🔴 CRITICAL #2.2 (debts): ĐÃ FIX
- 🔴 CRITICAL #2.3 (users): ĐÃ FIX
- 🔴 CRITICAL #2.4 (reports): ĐÃ FIX
- 🔴 CRITICAL #2.5 (orders): ĐÃ FIX

Sau khi Vercel redeploy, tài khoản SALES sẽ nhận lỗi 403/redirect khi truy cập 5 trang trên.

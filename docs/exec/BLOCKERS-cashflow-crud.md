# Blockers: cashflow-crud

## Blocker #1 — Discovered at MSEW Bước 1
- **Type:** Impossible (MSEW code không khớp schema thực tế → script sẽ throw runtime error)
- **Mô tả:** MSEW Bước 1 yêu cầu tạo `scripts/add-cashflow-perms.ts` với mảng quyền:
  ```typescript
  { id: "cashflow.update", name: "Sửa giao dịch", module: "CASHFLOW" }
  ```
  Nhưng schema `Permission` thực tế (`prisma/schema.prisma:42-47`) là:
  ```prisma
  model Permission {
    id          String  @id @default(cuid())   // cuid tự sinh, KHÔNG dùng làm mã quyền
    code        String  @unique                // "product.create", "order.deliver" — mã quyền thật
    description String?
    roles       RolePermission[]
  }
  ```
  3 điểm không khớp:
  1. Field `name` — schema **KHÔNG có** (chỉ có `description`).
  2. Field `module` — schema **KHÔNG có**.
  3. `id: "cashflow.update"` làm mã quyền — convention codebase dùng `code` làm mã quyền. Bằng chứng: `requirePermission(userId, code)` (`src/lib/authorize.ts:13`) tìm theo `code`; toàn bộ permission hiện có dạng `"product.create"`, `"order.deliver"` (`schema.prisma:44` comment).
- **Hậu quả:** Chạy `npx tsx scripts/add-cashflow-perms.ts` → Prisma throw `Unknown field `name``/`module` (validation error). DB không tiêm được quyền → Bước 3 (`requirePermission("cashflow.update")`) luôn Forbidden.
- **Suggestion (cho Planner):** Sửa script Bước 1 thành:
  ```typescript
  const perms = [
    { code: "cashflow.update", description: "Sửa giao dịch" },
    { code: "cashflow.delete", description: "Xoá giao dịch" },
  ];
  await prisma.permission.upsert({ where: { code: p.code }, update: {}, create: p });
  // ...upsert rolePermission theo permission.code (tìm permission qua code trước)
  ```
- **Awaiting:** Planner review HOẶC sếp cho phép Tier 2 tự chuẩn hóa (fix cơ học theo schema thật).

## Pre-check các bước còn lại (không blocker)
- **Bước 2:** `TransactionService` có đủ dependency (`assertNotPeriodLocked`, `RecordTransactionInput`, `AuditAndSecurityHelper.logAction`, `Money`). OK.
- **Bước 3:** `recordTransaction` đã tồn tại ở `src/app/actions/order-actions.ts:274` → dùng file đó đúng. Lưu ý: MSEW viết `requirePermission("cashflow.update")` thiếu `userId` — signature thực tế `requirePermission(userId, code)`; Tier 2 sẽ gõ đủ tham số.
- **Bước 4:** `CashflowClient.tsx` có bảng giao dịch (4 cột: Ngày/TK/Số tiền/Diễn giải, dòng 142-156) + form (dòng 100-135) → thêm cột Thao tác + edit mode được. File đã `eslint-disable no-explicit-any`.

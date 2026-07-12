# Skill Usage: quick-edit-product

## Step 1 — Tạo QuickEditProductForm (Client Component popover)
- Assigned skills: frontend-development (primary)
- Invoked at: 2026-07-12
- Effectiveness: HIGH
- CodeGraph tools used: none (MSEW không yêu cầu Pre/Post-check)
- Notes: Tạo `src/components/catalog/QuickEditProductForm.tsx` — popover form sửa nhanh (Tên SP, ĐVT, Giá nhập, Giá bán). Pattern đồng bộ với `AdjustForm`: `"use client"`, `useTransition`, `useRouter`, gọi server action `updateCatalogItem("product", id, fd)`, popover `position: absolute` / `zIndex: 50` / `boxShadow: var(--shadow-lg)`, toggle nút "✏ Sửa", message success/error. Chuẩn hóa `any`→`unknown` cho sellPrice/buyPrice (lint rule `no-explicit-any`).

## Step 2 — Nhúng QuickEditProductForm vào ProductListPage
- Assigned skills: frontend-development (primary)
- Invoked at: 2026-07-12
- Effectiveness: HIGH
- CodeGraph tools used: none (MSEW không yêu cầu Pre/Post-check)
- Pre-check thủ công (chống ảo giác): xác nhận `updateCatalogItem` export tại `src/app/actions/catalog.ts:54` với signature `(entity, id, formData)`; `Product` model (prisma/schema.prisma:61) có `buyPrice`/`sellPrice` (Decimal) khớp prop; `ActionResult` (`src/lib/action-result.ts`) có `.ok`/`.error` khớp code MSEW; "Sửa" `<Link href={/catalog/product/{id}/edit}>` nằm đúng dòng 74–78 như MSEW mô tả.
- Notes: Thêm `import QuickEditProductForm` ngay sau import `AdjustForm`. Xóa block `<Link href={/catalog/product/{id}/edit}>…✏ Sửa…</Link>` (5 dòng) và thay bằng `<QuickEditProductForm product={p2} />`. Giữ nguyên nút "👁 Xem" (Link `/products/{id}`) và `<AdjustForm>` (popover Điều chỉnh).

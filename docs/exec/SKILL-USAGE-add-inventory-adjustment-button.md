# Skill Usage: add-inventory-adjustment-button

## Step 1 — AdjustForm Popover Modal
- Assigned skills: ui-styling (primary)
- Invoked at: 2026-07-12
- Effectiveness: HIGH
- CodeGraph tools used: none (MSEW không yêu cầu Pre/Post-check)
- Notes: Thay return block inline-form → popover (`position: absolute`, `zIndex: 50`, `boxShadow: var(--shadow-lg)`). Chuẩn hóa CSS nút "Điều chỉnh" (height 32, padding "0 12px", border `1px solid var(--color-warning)`, `display: flex`, `alignItems: center`, `gap: 6`, `transition: all 0.2s`). Nút submit `width: 100%`, `fontWeight: 700`.

## Step 2 — AdjustForm vào ProductListPage
- Assigned skills: ui-styling (primary)
- Invoked at: 2026-07-12
- Effectiveness: HIGH
- CodeGraph tools used: none (MSEW không yêu cầu Pre/Post-check)
- Notes: Thêm `import AdjustForm` ngay sau dòng import `Pagination`. Thay `<td>` cột Action bằng flex container chứa 3 nút: "👁 Xem" (border `var(--color-primary)`, color `var(--color-primary)`), "✏ Sửa" (border `var(--color-border-strong)`, color `var(--color-foreground-muted)`), và `<AdjustForm>` (popover warning). Tất cả nút height 32, padding "0 12px", `display: flex`, `alignItems: center`, `gap: 6`.

# CHANGELOG EXEC: edit-order-date

## Các thay đổi đã thực hiện

| Step | File | Lines Changed | Status |
|------|------|---------------|--------|
| 1 | prisma/seed.ts | +1, -0 | DONE |
| 1 | prisma/migrations/add-order-edit-date-permission.sql | new file | DONE |
| 2 | src/lib/authorize.ts | +12, -0 | DONE |
| 2 | src/app/(dashboard)/orders/edit/[id]/page.tsx | +15, -1 | DONE |
| 3 | src/app/(dashboard)/orders/edit/EditOrderClient.tsx | +20, -3 | DONE |
| 4 | src/app/(dashboard)/orders/actions.ts | +14, -4 | DONE |
| 5 | src/services/order-orchestrator.service.ts | +16, -0 | DONE |

## Chi tiết

### Step 1: Khởi tạo Permission
- Thêm `"order.edit_date"` vào `PERMISSION_CODES` trong seed.ts
- Tạo SQL migration `add-order-edit-date-permission.sql` để áp dụng trên production

### Step 2: Truyền cờ phân quyền
- Export mới `hasPermission()` từ `@/lib/authorize` (trả boolean, không throw)
- `page.tsx`: lấy `canEditDate = await hasPermission(session?.user?.id, "order.edit_date")`
- Pass prop `canEditDate` xuống `EditOrderClient`

### Step 3: UI
- Thêm fields `saleDate` / `orderDate` vào `EditOrderInitial`
- Thêm prop `canEditDate` vào component
- Render `<input type="date" />` nếu `canEditDate = true`
- Khi submit, truyền trường ngày vào payload

### Step 4: Server Action Security
- `editSalesOrderAction`: nếu payload có `saleDate` → gọi `requirePermission("order.edit_date")`
- `editPurchaseOrderAction`: nếu payload có `orderDate` → gọi `requirePermission("order.edit_date")`

### Step 5: Service Update
- `UpdateSalesOrderInput` thêm field `saleDate?: Date`
- `UpdatePurchaseOrderInput` thêm field `orderDate?: Date`
- Sau khi commit transaction, nếu có date → update DB tương ứng

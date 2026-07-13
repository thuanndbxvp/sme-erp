# MSEW: Thêm tính năng sửa ngày tạo đơn (Backdate)

## 1. Khởi tạo Quyền (Permission)
- **Hành động:** Tạo một kịch bản Prisma hoặc file SQL nhỏ để insert quyền mới. Nếu không cần script, thêm cứng qua CLI:
  ```bash
  npx prisma studio # Hoặc dùng psql để insert "order.edit_date" vào bảng Permission
  ```
  *(Đảm bảo gán quyền này cho Admin hoặc Role tương ứng để test).*

## 2. Truyền cờ phân quyền xuống UI
- **File:** `src/app/(dashboard)/orders/edit/[id]/page.tsx`
- **Hành động:**
  - Import `hasPermission` từ `@/lib/authorize` (hoặc viết hàm check tương tự nếu chưa export).
  - Lấy session: `const session = await auth();`
  - Khởi tạo biến boolean: `const canEditDate = await hasPermission(session?.user?.id, "order.edit_date");` (có thể cần truy vấn `prisma.user.findUnique` kèm role/permissions nếu hàm `hasPermission` không public trả boolean).
  - Pass prop `canEditDate` xuống `<EditOrderClient ... canEditDate={canEditDate} />`.

## 3. Cập nhật UI (EditOrderClient)
- **File:** `src/app/(dashboard)/orders/edit/EditOrderClient.tsx`
- **Hành động:**
  - Sửa interface `EditOrderInitial` thêm trường `saleDate?: string | null` (và `orderDate` nếu cần, có thể gọi chung là `orderDate`).
  - Thêm prop `canEditDate?: boolean` vào Component.
  - Bổ sung ô nhập liệu `type="date"` phía dưới phần trạng thái hoặc ở khu vực Header đơn hàng:
    ```tsx
    {canEditDate && (
      <div style={{ marginBottom: "var(--space-4)" }}>
        <label>Ngày tạo đơn:</label>
        <input type="date" value={saleDateStr} onChange={(e) => setSaleDate(e.target.value)} />
      </div>
    )}
    ```
  - Khi submit, đẩy thêm trường `saleDate` vào payload.

## 4. Bảo mật tại Server Actions
- **File:** `src/app/(dashboard)/orders/actions.ts`
- **Hành động:**
  - Sửa tham số truyền vào của `editSalesOrderAction` và `editPurchaseOrderAction` (đón thêm `saleDate`).
  - **Quan trọng:**
    ```typescript
    if (data.saleDate) {
      await requirePermission(session?.user?.id, "order.edit_date");
    }
    ```
  - Truyền `saleDate` (chuyển sang Date object) vào hàm `OrderOrchestrator.updateSalesOrder`.

## 5. Cập nhật Service
- **File:** `src/services/order-orchestrator.service.ts`
- **Hành động:**
  - Chắc chắn hàm `updateSalesOrder` và `updatePurchaseOrder` nhận và update trường `saleDate` / `orderDate` vào DB bằng Prisma.

# Micro-Step Execution Workflow (MSEW): Cashflow CRUD

Hãy thực hiện tuần tự các bước sau để hoàn thành tính năng:

## Bước 1: Khởi tạo Quyền (RBAC Permissions)
Tạo một file script tạm `scripts/add-cashflow-perms.ts` để tiêm 2 quyền vào DB:
```typescript
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const perms = [
    { code: "cashflow.update", description: "Sửa giao dịch" },
    { code: "cashflow.delete", description: "Xoá giao dịch" },
  ];
  
  for (const p of perms) {
    await prisma.permission.upsert({
      where: { code: p.code },
      update: {},
      create: p,
    });
  }
  
  // Gắn vào role ADMIN
  const admin = await prisma.role.findFirst({ where: { name: "ADMIN" } });
  if (admin) {
    for (const p of perms) {
      const dbPerm = await prisma.permission.findUnique({ where: { code: p.code } });
      if (dbPerm) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: admin.id, permissionId: dbPerm.id } },
          update: {},
          create: { roleId: admin.id, permissionId: dbPerm.id },
        });
      }
    }
  }
  console.log("Đã thêm quyền sửa/xoá Cashflow!");
}
main().catch(console.error).finally(() => prisma.$disconnect());
```
Chạy lệnh `npx tsx scripts/add-cashflow-perms.ts` ở Terminal rồi có thể xoá file này đi.

## Bước 2: Cập nhật `TransactionService`
Trong file `src/services/transaction.service.ts`:
1. Thêm hàm `deleteTransaction(id: string, prismaClient = defaultPrisma)`
   - Gọi `assertNotPeriodLocked`.
   - Mở `$transaction`.
   - Tìm Transaction (`tx.transaction.findUnique`). Ném lỗi nếu không thấy hoặc nếu `salesOrderId`/`purchaseOrderId` != null.
   - Khoá Account (`SELECT FOR UPDATE`).
   - Revert balance: Nếu `INCOME` thì `balance -= amount`, nếu `EXPENSE` thì `balance += amount`. Lưu vào `Account`.
   - Xóa `Transaction`.
   - Gọi `AuditAndSecurityHelper.logAction` với action `DELETE`.
2. Thêm hàm `updateTransaction(id: string, input: RecordTransactionInput, prismaClient = defaultPrisma)`
   - Gọi `assertNotPeriodLocked`.
   - Mở `$transaction`.
   - Tìm Transaction cũ. Ném lỗi nếu gắn với Order.
   - Gọi logic revert (giống như xóa) trên Account cũ.
   - Tính toán và cộng/trừ số tiền mới trên Account mới (giống như tạo mới).
   - `tx.transaction.update` với dữ liệu mới.
   - Ghi Log `UPDATE`.

*(Gợi ý: Tham khảo logic tạo mới hiện có để xử lý cộng trừ số tiền và check âm)*

## Bước 3: Tạo Server Actions
Trong file `src/app/actions/order-actions.ts` (hoặc file action tương ứng):
1. Thêm `export async function updateTransactionAction(id: string, formData: FormData)`
   - Check auth() và `requirePermission("cashflow.update")`.
   - Parse `formData` thành `RecordTransactionInput`.
   - Gọi `TransactionService.updateTransaction(id, input)`.
   - Gọi `revalidatePath("/cashflow")`.
2. Thêm `export async function deleteTransactionAction(id: string)`
   - Check `requirePermission("cashflow.delete")`.
   - Gọi `TransactionService.deleteTransaction(id)`.
   - Gọi `revalidatePath("/cashflow")`.

*(Bọc trong `safeAction` tương tự như `recordTransaction` hiện tại)*

## Bước 4: Cập nhật UI `CashflowClient.tsx`
1. Đổi bảng danh sách giao dịch: Thêm cột `<th>Thao tác</th>`.
2. Trên mỗi dòng giao dịch, nếu `!t.salesOrderId && !t.purchaseOrderId`, hiển thị 2 nút (icon hoặc text nhỏ): **Sửa** | **Xoá**.
3. **Xử lý Xoá:** Nút Xoá có `onClick` gọi `if (confirm("...")) startTransition(() => deleteTransactionAction(t.id))`.
4. **Xử lý Sửa:** 
   - Quản lý state `editTx` (chứa dữ liệu giao dịch đang sửa).
   - Khi bấm "Sửa", cuộn lên form, set `editTx`. Để form nhận `defaultValue` mới, hãy bọc thẻ `<form key={editTx ? editTx.id : "new"}>`.
   - Nút submit sẽ kiểm tra nếu có `editTx` thì gọi `updateTransactionAction(editTx.id, fd)`, ngược lại gọi `recordTransaction`.

Kiểm tra lại kỹ xem mọi thao tác có lỗi gì không trước khi hoàn thành!

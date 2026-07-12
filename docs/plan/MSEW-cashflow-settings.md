# MSEW: Đổi tab Phân loại thành Cấu hình & Thêm chức năng tạo Quỹ

Hãy tuần tự thực hiện các bước sau:

## Bước 1: Khởi tạo Quyền (RBAC)
Tạo script `scripts/add-settings-perms.ts` để tiêm 2 quyền vào DB:
```typescript
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const perms = [
    { code: "cashflow.account.manage", description: "Quản lý Quỹ (Thêm/Sửa/Xóa)" },
    { code: "cashflow.category.manage", description: "Quản lý Phân loại (Thêm/Sửa/Xóa)" },
  ];
  
  for (const p of perms) {
    await prisma.permission.upsert({ where: { code: p.code }, update: {}, create: p });
  }
  
  const admin = await prisma.role.findFirst({ where: { name: "ADMIN" } });
  if (admin) {
    for (const p of perms) {
      const dbPerm = await prisma.permission.findUnique({ where: { code: p.code } });
      if (dbPerm) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: admin.id, permissionId: dbPerm.id } },
          update: {}, create: { roleId: admin.id, permissionId: dbPerm.id },
        });
      }
    }
  }
  console.log("Đã thêm quyền!");
}
main().catch(console.error).finally(() => prisma.$disconnect());
```
Chạy `npx tsx scripts/add-settings-perms.ts` và xoá script sau khi chạy.

## Bước 2: Server Actions & Check Quyền
Tạo file `src/app/actions/cashflow-settings.ts`:
1. Hàm `createAccount`, `updateAccount`, `deleteAccount`: 
   - Check quyền `cashflow.account.manage`.
   - **Ràng buộc:** Nếu `code` là `BANK` hoặc `CASH` thì chặn cứng, trả về lỗi "Không được phép sửa/xoá quỹ hệ thống".
   - Lưu ý khi xoá Account: Phải check bảng `Transaction` xem có giao dịch nào tham chiếu không, nếu có thì báo lỗi không cho xoá.
2. Hàm `createCategory`, `updateCategory`, `deleteCategory`:
   - Check quyền `cashflow.category.manage`.
   - **Ràng buộc:** Tránh sửa/xoá đối với Category có tên "Dòng tiền Kinh doanh" hoặc "Dòng tiền Vận hành". (Throw error).
   - Lưu ý khi xoá Category: Check bảng `Transaction` xem có giao dịch nào tham chiếu không, nếu có báo lỗi. Kiểm tra cả category con.

## Bước 3: Cập nhật `CashflowClient.tsx`
1. Đổi tên tab "Phân loại" thành "Cấu hình" (bỏ tab "Tài khoản").
2. Trong `SettingsTab`, chia 2 khu vực dọc (Grid 1fr 1fr):
   - **Khu vực 1: Quản lý Quỹ:** Danh sách Account. Thêm nút Sửa/Xóa cho mỗi Account. Ẩn nút Sửa/Xoá nếu `a.code === 'BANK' || a.code === 'CASH'`. Có Form Thêm Mới/Sửa.
   - **Khu vực 2: Quản lý Phân loại:** Danh sách Categories (cây cha/con). Thêm nút Sửa/Xóa bên cạnh mỗi category. Ẩn nút Sửa/Xoá nếu category là "Dòng tiền Kinh doanh" hoặc "Dòng tiền Vận hành". Form Thêm Mới/Sửa.
   - **Lưu ý form Phân loại:** Chỉnh sửa thẻ `<select name="direction">` (hoặc `type`) bổ sung thêm option `<option value="ALL">Không phân loại</option>`. Sửa lại giao diện nếu cần để hiển thị nhãn "Không phân loại" cho các category có `type === "ALL"`.
3. Khi bấm Xoá cần hiện popup `confirm()`. Khi bấm Sửa thì đổi Form thành chế độ Sửa (bọc form bằng thuộc tính `key` tương ứng với `editId` để tự reset giá trị default).

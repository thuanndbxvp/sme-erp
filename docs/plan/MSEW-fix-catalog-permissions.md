# MSEW: Fix lỗi thiếu quyền thêm Sửa/Xóa Catalog (Khách hàng, NCC)

Hãy thực hiện từng bước sau để bơm các quyền còn thiếu vào database và cấp phát cho Admin.

## Bước 1: Tạo Script Bổ sung Quyền
Tạo file `scripts/fix-catalog-perms.ts` với nội dung sau:
```typescript
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const perms = [
    { code: "customer.read", description: "Xem Khách hàng" },
    { code: "customer.write", description: "Thêm/Sửa/Xóa Khách hàng" },
    { code: "supplier.read", description: "Xem Nhà cung cấp" },
    { code: "supplier.write", description: "Thêm/Sửa/Xóa Nhà cung cấp" },
    { code: "product.read", description: "Xem Sản phẩm" },
    { code: "product.write", description: "Thêm/Sửa/Xóa Sản phẩm" },
    { code: "warehouse.read", description: "Xem Kho" },
    { code: "warehouse.write", description: "Thêm/Sửa/Xóa Kho" },
  ];
  
  // 1. Khởi tạo vào bảng Permission
  for (const p of perms) {
    await prisma.permission.upsert({
      where: { code: p.code },
      update: {},
      create: p
    });
  }
  
  // 2. Tìm role ADMIN
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
    console.log("Đã cấp đầy đủ quyền Catalog cho role ADMIN!");
  } else {
    console.log("Không tìm thấy role ADMIN trong DB.");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
```

## Bước 2: Chạy Script
Chạy lệnh sau trên terminal:
```bash
npx tsx scripts/fix-catalog-perms.ts
```

## Bước 3: Dọn dẹp
Sau khi chạy xong và log ra "Đã cấp đầy đủ quyền...", bạn có thể xóa file `scripts/fix-catalog-perms.ts` để giữ project sạch sẽ.

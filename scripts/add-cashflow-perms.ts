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

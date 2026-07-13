import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ROLE_PERMISSIONS: Record<string, string[]> = {
  GIAM_DOC: [
    "product.read", "product.write",
    "customer.read", "customer.write",
    "supplier.read", "supplier.write",
    "warehouse.read", "warehouse.write",
    "account.read", "account.write",
    "cashflow.transaction.edit", "cashflow.transaction.delete",
    "inventory.adjust",
    "users.delete",
    "hr.view", "hr.manage",
    "commission.approve"
  ],
  ACCOUNTANT: [
    "product.read", "customer.read", "supplier.read", "warehouse.read",
    "account.read", "account.write",
    "cashflow.transaction.edit", "cashflow.transaction.delete",
    "hr.view", "hr.manage"
  ],
  SALES: [
    "product.read",
    "customer.read", "customer.write"
  ],
  WAREHOUSE: [
    "product.read",
    "warehouse.read", "warehouse.write",
    "inventory.adjust"
  ],
  DELIVERY: [
    "warehouse.read"
  ],
  COLLABORATOR: [
    "product.read"
  ]
};

async function main() {
  console.log("Đang cấu hình các Role và Permission cơ bản...");

  // Tạo thêm một số Permission nếu chưa có (để chắc chắn)
  const allPerms = new Set<string>();
  Object.values(ROLE_PERMISSIONS).forEach(perms => perms.forEach(p => allPerms.add(p)));

  await Promise.all(
    Array.from(allPerms).map((code) =>
      prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code, description: `Quyền: ${code}` },
      })
    )
  );

  const permissions = await prisma.permission.findMany();
  const permMap = new Map(permissions.map(p => [p.code, p.id]));

  for (const [roleName, permCodes] of Object.entries(ROLE_PERMISSIONS)) {
    console.log(`Đang xử lý Role: ${roleName}...`);
    
    // Tạo Role
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName, description: `Vai trò: ${roleName}` }
    });

    // Reset quyền cũ (nếu có)
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });

    // Cấp quyền mới
    const rolePerms = permCodes.map(code => ({
      roleId: role.id,
      permissionId: permMap.get(code)!
    }));
    
    if (rolePerms.length > 0) {
      await prisma.rolePermission.createMany({ data: rolePerms });
    }
  }

  // Dọn dẹp Role rác "SALE" nếu có
  const oldSaleRole = await prisma.role.findUnique({ where: { name: "SALE" }});
  if (oldSaleRole) {
    console.log("Xóa role rác: SALE");
    await prisma.user.updateMany({ where: { roleId: oldSaleRole.id }, data: { roleId: null }});
    await prisma.role.delete({ where: { id: oldSaleRole.id }});
  }

  console.log("Cấu hình Role thành công!");
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());

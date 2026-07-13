import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

/**
 * Seed P0-2: 1 admin (role ADMIN + full permission) + vài danh mục mẫu.
 * Idempotent — dùng upsert theo unique key, chạy lại không nhân đôi.
 */
const prisma = new PrismaClient();

// Danh sách permission nền tảng (mở rộng dần theo phase).
const PERMISSION_CODES = [
  "product.read",
  "product.write",
  "customer.read",
  "customer.write",
  "supplier.read",
  "supplier.write",
  "warehouse.read",
  "warehouse.write",
  "account.read",
  "account.write",
  "cashflow.transaction.edit",
  "cashflow.transaction.delete",
  "inventory.adjust",
  "users.delete", // Xóa cứng người dùng (MSEW-user-management-ui)
  "hr.view",        // Xem danh sách nhân viên & bảng lương (MSEW-payroll-hr)
  "hr.manage",      // Cấp tạm ứng, chỉnh sửa lương cứng (MSEW-payroll-hr)
  "commission.approve", // Duyệt hoa hồng đơn hàng (MSEW-payroll-hr)
] as const;

async function main() {
  // 1) Permissions
  await Promise.all(
    PERMISSION_CODES.map((code) =>
      prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code },
      }),
    ),
  );
  const permissions = await prisma.permission.findMany();

  // 2) Role ADMIN + gán toàn bộ permission
  const adminRole = await prisma.role.upsert({
    where: { name: "ADMIN" },
    update: {},
    create: { name: "ADMIN", description: "Toàn quyền hệ thống" },
  });
  await Promise.all(
    permissions.map((p) =>
      prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: adminRole.id, permissionId: p.id } },
        update: {},
        create: { roleId: adminRole.id, permissionId: p.id },
      }),
    ),
  );

  // 3) User admin. Mật khẩu chỉ để dev — deploy thật phải đổi.
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "admin12345";
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@sme-erp.local" },
    update: { roleId: adminRole.id },
    create: {
      email: "admin@sme-erp.local",
      name: "Administrator",
      passwordHash,
      roleId: adminRole.id,
    },
  });

  // 4) Danh mục mẫu
  await prisma.account.upsert({
    where: { code: "CASH" },
    update: {},
    create: { code: "CASH", name: "Tiền mặt" },
  });
  await prisma.account.upsert({
    where: { code: "BANK" },
    update: {},
    create: { code: "BANK", name: "Ngân hàng" },
  });
  await prisma.warehouse.upsert({
    where: { code: "WH1" },
    update: {},
    create: { code: "WH1", name: "Kho chính" },
  });
  await prisma.product.upsert({
    where: { sku: "SP001" },
    update: {},
    create: { sku: "SP001", name: "Sản phẩm mẫu A", unit: "cái", buyPrice: 10000, sellPrice: 15000 },
  });

  const counts = {
    permissions: await prisma.permission.count(),
    roles: await prisma.role.count(),
    users: await prisma.user.count(),
    accounts: await prisma.account.count(),
    warehouses: await prisma.warehouse.count(),
    products: await prisma.product.count(),
  };
  // Dùng process.stdout thay console.* (bị ESLint cấm); seed là script CLI, không phải request.
  process.stdout.write(`Seed done. admin=${admin.email} counts=${JSON.stringify(counts)}\n`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e: unknown) => {
    await prisma.$disconnect();
    process.stderr.write(`Seed failed: ${String(e)}\n`);
    process.exit(1);
  });

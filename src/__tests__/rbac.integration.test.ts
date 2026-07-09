/**
 * Integration test RBAC (P0-4) — CHẠY TRÊN DB THẬT (Neon).
 * Chứng minh checkPermission load TƯƠI từ DB: cấp/thu quyền phản ánh ngay,
 * không cache token. Tự skip nếu không có DATABASE_URL.
 */
import { config } from "dotenv";
config();

import { PrismaClient } from "@prisma/client";
import { RbacService } from "@/services/rbac.service";

const hasDb = !!process.env.DATABASE_URL;
const describeIf = hasDb ? describe : describe.skip;

// Integration test chạm Neon remote — nhiều round-trip tuần tự, nới timeout.
jest.setTimeout(60_000);

const prisma = new PrismaClient();
const TAG = "__rbac_it__";

async function cleanup() {
  await prisma.user.deleteMany({ where: { email: { contains: TAG } } });
  await prisma.role.deleteMany({ where: { name: { contains: TAG } } });
  await prisma.permission.deleteMany({ where: { code: { contains: TAG } } });
}

describeIf("RbacService.checkPermission integration (P0-4)", () => {
  beforeAll(cleanup);
  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("cấp quyền qua DB → checkPermission true; user role rỗng → false; đổi DB phản ánh ngay", async () => {
    const permCode = `${TAG}.act`;
    const perm = await prisma.permission.create({ data: { code: permCode } });

    const roleWith = await prisma.role.create({
      data: {
        name: `${TAG}-with`,
        permissions: { create: [{ permissionId: perm.id }] },
      },
    });
    const roleWithout = await prisma.role.create({ data: { name: `${TAG}-without` } });

    const userWith = await prisma.user.create({
      data: {
        email: `with-${TAG}@t.local`,
        name: "with",
        passwordHash: "x",
        roleId: roleWith.id,
      },
    });
    const userWithout = await prisma.user.create({
      data: {
        email: `without-${TAG}@t.local`,
        name: "without",
        passwordHash: "x",
        roleId: roleWithout.id,
      },
    });
    const userNoRole = await prisma.user.create({
      data: { email: `norole-${TAG}@t.local`, name: "norole", passwordHash: "x" },
    });

    // Trạng thái ban đầu load từ DB
    await expect(RbacService.checkPermission(prisma, userWith.id, permCode)).resolves.toBe(
      true,
    );
    await expect(
      RbacService.checkPermission(prisma, userWithout.id, permCode),
    ).resolves.toBe(false);
    await expect(RbacService.checkPermission(prisma, userNoRole.id, permCode)).resolves.toBe(
      false,
    );

    // THU quyền trong DB → lần kiểm kế tiếp phải thấy false NGAY (load tươi, không cache)
    await prisma.rolePermission.delete({
      where: { roleId_permissionId: { roleId: roleWith.id, permissionId: perm.id } },
    });
    await expect(RbacService.checkPermission(prisma, userWith.id, permCode)).resolves.toBe(
      false,
    );

    // Vô hiệu hóa user → deny-all dù có role
    await prisma.rolePermission.create({
      data: { roleId: roleWith.id, permissionId: perm.id },
    });
    await prisma.user.update({ where: { id: userWith.id }, data: { isActive: false } });
    await expect(RbacService.checkPermission(prisma, userWith.id, permCode)).resolves.toBe(
      false,
    );
  });
});

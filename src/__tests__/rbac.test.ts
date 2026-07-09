import { requirePermission } from "@/lib/authorize";
import {
  RbacService,
  ForbiddenError,
  UnauthorizedError,
} from "@/services/rbac.service";
import type { PrismaClient } from "@prisma/client";

/**
 * Unit test enforce quyền (P0-4) — dùng prisma giả (không chạm DB).
 * Chứng minh: chưa đăng nhập → Unauthorized; có quyền → qua; thiếu quyền → Forbidden.
 */

// Prisma giả: findUnique trả user theo kịch bản cấu hình sẵn.
function fakePrisma(user: unknown): PrismaClient {
  return {
    user: {
      findUnique: jest.fn().mockResolvedValue(user),
    },
  } as unknown as PrismaClient;
}

describe("requirePermission (P0-4)", () => {
  const CODE = "product.write";

  it("chưa đăng nhập (userId null) → UnauthorizedError", async () => {
    const prisma = fakePrisma(null);
    await expect(requirePermission(null, CODE, prisma)).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });

  it("user active + role có permission → trả userId (qua)", async () => {
    const prisma = fakePrisma({
      isActive: true,
      roleId: "role1",
      role: { permissions: [{ permissionId: "p1" }] },
    });
    await expect(requirePermission("user1", CODE, prisma)).resolves.toBe("user1");
  });

  it("user active nhưng role KHÔNG có permission → ForbiddenError", async () => {
    const prisma = fakePrisma({
      isActive: true,
      roleId: "role1",
      role: { permissions: [] },
    });
    await expect(requirePermission("user1", CODE, prisma)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("user KHÔNG có role → deny-all (Forbidden)", async () => {
    const prisma = fakePrisma({ isActive: true, roleId: null, role: null });
    await expect(requirePermission("user1", CODE, prisma)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("user không active → deny-all (Forbidden)", async () => {
    const prisma = fakePrisma({
      isActive: false,
      roleId: "role1",
      role: { permissions: [{ permissionId: "p1" }] },
    });
    await expect(requirePermission("user1", CODE, prisma)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("user không tồn tại → deny-all (Forbidden)", async () => {
    const prisma = fakePrisma(null);
    await expect(requirePermission("ghost", CODE, prisma)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("ForbiddenError mang tên permission cần", async () => {
    const prisma = fakePrisma({ isActive: true, roleId: "r", role: { permissions: [] } });
    await expect(requirePermission("user1", CODE, prisma)).rejects.toMatchObject({
      requiredPermission: CODE,
    });
  });
});

describe("RbacService.checkPermission trả boolean đúng (unit)", () => {
  it("true khi có permission", async () => {
    const prisma = fakePrisma({
      isActive: true,
      roleId: "r",
      role: { permissions: [{ permissionId: "p1" }] },
    });
    await expect(RbacService.checkPermission(prisma, "u", "x")).resolves.toBe(true);
  });
  it("false khi role rỗng permission", async () => {
    const prisma = fakePrisma({ isActive: true, roleId: "r", role: { permissions: [] } });
    await expect(RbacService.checkPermission(prisma, "u", "x")).resolves.toBe(false);
  });
});

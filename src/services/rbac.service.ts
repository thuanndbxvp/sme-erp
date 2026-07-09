import type { PrismaClient } from "@prisma/client";

/**
 * RbacService (P0-4) — kiểm quyền dựa trên vai trò.
 *
 * Bài học V2 #3/#4: KHÔNG tin quyền từ token/client. Mỗi lần kiểm quyền đều
 * load TƯƠI từ DB (User → Role → RolePermission → Permission).
 *
 * Deny-by-default: user không tồn tại / không active / không có role / role
 * không chứa permission → FALSE. Không có "quyền mặc định".
 */
export class RbacService {
  /** Trả về true nếu user có permission `code`. Deny-all nếu thiếu điều kiện. */
  static async checkPermission(
    prisma: PrismaClient,
    userId: string,
    code: string,
  ): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        isActive: true,
        roleId: true,
        role: {
          select: {
            permissions: {
              where: { permission: { code } },
              select: { permissionId: true },
            },
          },
        },
      },
    });

    if (!user || !user.isActive || !user.roleId || !user.role) {
      return false;
    }
    return user.role.permissions.length > 0;
  }

  /** Lấy toàn bộ permission code của user (cho UI/menu). Deny-all → mảng rỗng. */
  static async getPermissions(prisma: PrismaClient, userId: string): Promise<string[]> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        isActive: true,
        role: {
          select: {
            permissions: { select: { permission: { select: { code: true } } } },
          },
        },
      },
    });
    if (!user || !user.isActive || !user.role) {
      return [];
    }
    return user.role.permissions.map((rp) => rp.permission.code);
  }
}

/** Lỗi ném khi không đủ quyền — action/route bắt để trả 403. */
export class ForbiddenError extends Error {
  constructor(public readonly requiredPermission: string) {
    super(`Không có quyền: ${requiredPermission}`);
    this.name = "ForbiddenError";
  }
}

/** Không đăng nhập. */
export class UnauthorizedError extends Error {
  constructor() {
    super("Chưa đăng nhập");
    this.name = "UnauthorizedError";
  }
}

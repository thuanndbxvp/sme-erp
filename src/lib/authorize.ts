import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { RbacService, ForbiddenError, UnauthorizedError } from "@/services/rbac.service";

/**
 * Lõi enforce quyền ở TẦNG SERVER (bài học V2: không chỉ ẩn UI).
 *
 * File này KHÔNG import next-auth để phần logic thuần này test được không cần
 * mock ESM. Wrapper server action gắn với NextAuth nằm ở `with-permission.ts`.
 *
 * Ném UnauthorizedError nếu chưa đăng nhập, ForbiddenError nếu thiếu quyền.
 */
export async function requirePermission(
  userId: string | null | undefined,
  code: string,
  prisma: PrismaClient = defaultPrisma,
): Promise<string> {
  if (!userId) {
    throw new UnauthorizedError();
  }
  const allowed = await RbacService.checkPermission(prisma, userId, code);
  if (!allowed) {
    throw new ForbiddenError(code);
  }
  return userId;
}

/**
 * Kiểm tra quyền không ném lỗi, trả về boolean. Dùng cho UI gating
 * (chỉ để ẩn/hiện nút), KHÔNG thay thế cho `requirePermission` ở server action.
 * Trả về false nếu chưa đăng nhập.
 */
export async function hasPermission(
  userId: string | null | undefined,
  code: string,
  prisma: PrismaClient = defaultPrisma,
): Promise<boolean> {
  if (!userId) {
    return false;
  }
  return RbacService.checkPermission(prisma, userId, code);
}

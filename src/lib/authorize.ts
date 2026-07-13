import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { RbacService, ForbiddenError, UnauthorizedError } from "@/services/rbac.service";
import { redirect } from "next/navigation";

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

/**
 * Kiểm tra quyền cho Server Component (Page).
 * Nếu không có quyền sẽ tự động redirect về trang chủ kèm báo lỗi,
 * tránh để Next.js ném lỗi 500 ở production.
 */
export async function requirePagePermission(
  userId: string | null | undefined,
  code: string,
  prisma: PrismaClient = defaultPrisma,
): Promise<string> {
  if (!userId) {
    redirect("/auth/sign-in");
  }
  const allowed = await RbacService.checkPermission(prisma, userId, code);
  if (!allowed) {
    redirect("/?error=forbidden");
  }
  return userId;
}

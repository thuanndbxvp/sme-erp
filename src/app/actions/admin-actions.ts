"use server";

import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/authorize";
import { prisma } from "@/lib/prisma";
import { safeAction } from "@/lib/action-result";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";

async function checkAdmin(session: { user?: { id?: string | null } } | null) {
  await requirePermission(session?.user?.id, "system.admin");
}

// === USER ===
export async function createUser(formData: FormData) {
  const session = await auth();
  await checkAdmin(session);
  return safeAction(async () => {
    const u = await prisma.user.create({
      data: {
        email: formData.get("email") as string,
        name: formData.get("name") as string,
        passwordHash: await bcrypt.hash(formData.get("password") as string, 10),
        roleId: (formData.get("roleId") as string) || null,
        isActive: true,
      },
    });
    revalidatePath("/users");
    return { id: u.id };
  });
}

export async function updateUser(formData: FormData) {
  const session = await auth();
  await checkAdmin(session);
  return safeAction(async () => {
    const id = formData.get("id") as string;
    const data: Record<string, unknown> = {};
    const name = formData.get("name") as string; if (name) data.name = name;
    const email = formData.get("email") as string; if (email) data.email = email;
    const roleId = formData.get("roleId") as string; data.roleId = roleId || null;
    const isActive = formData.get("isActive"); if (isActive !== null) data.isActive = isActive === "true";
    const pw = formData.get("password") as string; if (pw) data.passwordHash = await bcrypt.hash(pw, 10);
    await prisma.user.update({ where: { id }, data });
    revalidatePath("/users");
    return { id };
  });
}

// === ROLE ===
export async function createRole(formData: FormData) {
  const session = await auth();
  await checkAdmin(session);
  return safeAction(async () => {
    const permIds = formData.getAll("permissionIds") as string[];
    const r = await prisma.role.create({
      data: {
        name: formData.get("name") as string,
        permissions: { create: permIds.map(pid => ({ permissionId: pid })) },
      },
    });
    revalidatePath("/roles");
    return { id: r.id };
  });
}

export async function updateRolePermissions(formData: FormData) {
  const session = await auth();
  await checkAdmin(session);
  return safeAction(async () => {
    const roleId = formData.get("roleId") as string;
    const permIds = formData.getAll("permissionIds") as string[];
    await prisma.rolePermission.deleteMany({ where: { roleId } });
    await prisma.rolePermission.createMany({ data: permIds.map(pid => ({ roleId, permissionId: pid })) });
    revalidatePath("/roles");
    return { id: roleId };
  });
}

export async function deactivateUser(formData: FormData) {
  const session = await auth();
  await checkAdmin(session);
  return safeAction(async () => {
    const id = formData.get("id") as string;
    await prisma.user.update({ where: { id }, data: { isActive: false } });
    revalidatePath("/users");
    return { id };
  });
}

/**
 * Xóa cứng người dùng (MSEW-user-management-ui). Yêu cầu quyền `users.delete`.
 * - Chặn xóa nếu User đã phát sinh dữ liệu (FK): SalesOrder / PurchaseOrder / OrderStatusHistory
 *   (audit trail). Nếu có → trả lỗi "đã có giao dịch, chỉ Khóa được".
 * - Audit log entityType = "User".
 */
export async function deleteUser(formData: FormData) {
  const session = await auth();
  await requirePermission(session?.user?.id, "users.delete");
  return safeAction(async () => {
    const id = formData.get("id") as string;

    // Không cho xóa chính mình.
    if (session?.user?.id === id) {
      throw new Error("Không thể xóa chính bạn.");
    }

    const [salesCount, purchaseCount, historyCount] = await Promise.all([
      prisma.salesOrder.count({ where: { userId: id } }),
      prisma.purchaseOrder.count({ where: { userId: id } }),
      prisma.orderStatusHistory.count({ where: { userId: id } }),
    ]);

    if (salesCount + purchaseCount + historyCount > 0) {
      return { ok: false, error: "Người dùng đã có giao dịch, chỉ có thể KHÓA chứ không thể XÓA." } as const;
    }

    try {
      await prisma.user.delete({ where: { id } });
      AuditLogSafe(id, session?.user?.id);
      revalidatePath("/users");
      return { ok: true, id } as const;
    } catch (e: any) {
      if (e.code === 'P2003') {
        return { ok: false, error: "Không thể xóa người dùng này do vẫn còn dữ liệu liên quan (VD: Phiếu thu/chi, Audit log). Vui lòng chọn KHÓA." } as const;
      }
      console.error("[deleteUser] Error:", e);
      return { ok: false, error: "Đã xảy ra lỗi hệ thống khi xóa người dùng." } as const;
    }
  });
}

/** Ghi audit log cho deleteUser — tránh import động trong helper (rule no-dynamic-import). */
function AuditLogSafe(targetUserId: string, actorUserId: string | undefined) {
  import("@/lib/audit").then(({ AuditAndSecurityHelper }) => {
    AuditAndSecurityHelper.logAction({
      action: "DELETE",
      entityType: "User",
      entityId: targetUserId,
      userId: actorUserId,
      metadata: { message: `[XÓA NGƯỜI DÙNG] ${targetUserId}` },
    });
  }).catch(() => {
    // best-effort: không throw để tránh vỡ response.
  });
}

export async function resetUserPassword(formData: FormData) {
  const session = await auth();
  await checkAdmin(session);
  return safeAction(async () => {
    const id = formData.get("id") as string;
    const newPassword = formData.get("password") as string;
    if (!newPassword || newPassword.length < 6) throw new Error("Mật khẩu phải ít nhất 6 ký tự");
    await prisma.user.update({ where: { id }, data: { passwordHash: await bcrypt.hash(newPassword, 10) } });
    revalidatePath("/users");
    return { id };
  });
}

export async function updateOwnProfile(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Chưa đăng nhập");
  return safeAction(async () => {
    const data: Record<string, unknown> = {};
    const name = formData.get("name") as string; if (name) data.name = name;
    const pw = formData.get("password") as string;
    if (pw && pw.length >= 6) data.passwordHash = await bcrypt.hash(pw, 10);
    await prisma.user.update({ where: { id: session.user!.id! }, data });
    revalidatePath("/profile");
    return { id: session.user!.id! };
  });
}

// === TRANSACTION CATEGORY ===
export async function createTransactionCategory(formData: FormData) {
  await auth();
  return safeAction(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).$executeRawUnsafe(
      `INSERT INTO "TransactionCategory" ("id", "name", "type", "parentId") VALUES (gen_random_uuid(), $1, $2, $3)`,
      formData.get("name") as string,
      (formData.get("type") as string) || "EXPENSE",
      (formData.get("parentId") as string) || null,
    );
    revalidatePath("/transaction-categories");
    return { ok: true };
  });
}

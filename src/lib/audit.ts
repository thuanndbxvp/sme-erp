import { prisma } from "@/lib/prisma";

/**
 * Ghi AuditLog nhanh. Dùng trong server actions sau khi thực hiện hành động.
 * LUÔN gọi await — không fire-and-forget (đảm bảo log được ghi).
 */
export async function auditLog(opts: {
  action: string;
  entityType: string;
  entityId: string;
  userId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const data: Record<string, unknown> = {
    action: opts.action,
    entityType: opts.entityType,
    entityId: opts.entityId,
    userId: opts.userId ?? null,
  };
  if (opts.metadata) data.metadata = opts.metadata;
  await prisma.auditLog.create({ data: data as never });
}

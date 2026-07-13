import { prisma } from "@/lib/prisma";
import AuditTable from "@/components/audit/AuditTable";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
    select: { id: true, action: true, entityType: true, entityId: true, userId: true, createdAt: true, metadata: true },
  });

  const userIds = Array.from(new Set(logs.map(l => l.userId).filter(Boolean))) as string[];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true }
  });
  
  const userMap = new Map(users.map(u => [u.id, u.name]));

  const logsWithUser = logs.map(l => ({
    ...l,
    userName: l.userId ? (userMap.get(l.userId) || "Không xác định") : "Hệ thống"
  }));

  return (
    <div>
      <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, marginBottom: "var(--space-1)" }}>
        Nhật ký hoạt động
      </h1>
      <p style={{ fontSize: "var(--text-sm)", color: "var(--color-foreground-muted)", marginBottom: "var(--space-6)" }}>
        {logs.length} bản ghi gần nhất
      </p>
      <AuditTable logs={logsWithUser} />
    </div>
  );
}

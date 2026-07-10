import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, action: true, entityType: true, entityId: true, userId: true, createdAt: true },
  });

  return (
    <div>
      <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, marginBottom: "var(--space-1)" }}>
        Nhật ký hoạt động
      </h1>
      <p style={{ fontSize: "var(--text-sm)", color: "var(--color-foreground-muted)", marginBottom: "var(--space-6)" }}>
        {logs.length} bản ghi gần nhất
      </p>

      <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)", fontVariantNumeric: "tabular-nums" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--color-border)", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-foreground-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Hành động</th>
              <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Loại</th>
              <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>ID</th>
              <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Thời gian</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: "var(--space-10)", textAlign: "center", color: "var(--color-foreground-muted)" }}>Chưa có hoạt động nào</td>
              </tr>
            ) : (
              logs.map((log, i) => (
                <tr key={log.id} style={{ borderBottom: i < logs.length - 1 ? "1px solid var(--color-muted)" : "none", background: i % 2 === 0 ? "var(--color-surface)" : "var(--color-surface-hover)" }}>
                  <td style={{ padding: "var(--space-3) var(--space-4)" }}>{log.action}</td>
                  <td style={{ padding: "var(--space-3) var(--space-4)" }}>{log.entityType}</td>
                  <td style={{ padding: "var(--space-3) var(--space-4)", fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={log.entityId}>{log.entityId}</td>
                  <td style={{ padding: "var(--space-3) var(--space-4)", whiteSpace: "nowrap" }}>{new Date(log.createdAt).toLocaleString("vi-VN")}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

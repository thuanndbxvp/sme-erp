import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function TransactionCategoriesPage() {
  const cats = await prisma.$queryRawUnsafe<Array<{ id: string; name: string; type: string; parentId: string | null; isActive: boolean; createdAt: Date }>>(
    `SELECT * FROM "TransactionCategory" ORDER BY "type", "name"`
  );

  return (
    <div>
      <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, marginBottom: "var(--space-1)" }}>Danh mục thu chi</h1>
      <p style={{ fontSize: "var(--text-sm)", color: "var(--color-foreground-muted)", marginBottom: "var(--space-6)" }}>
        {cats.length} danh mục — 2 danh mục gốc: Chi phí vận hành, Chi phí kinh doanh
      </p>

      <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--color-border)", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-foreground-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Tên danh mục</th>
              <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Loại</th>
              <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Danh mục cha</th>
              <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {cats.map((c, i) => {
              const parent = cats.find(p => p.id === c.parentId);
              return (
                <tr key={c.id} style={{ borderBottom: i < cats.length - 1 ? "1px solid var(--color-muted)" : "none", background: i % 2 === 0 ? "var(--color-surface)" : "var(--color-surface-hover)" }}>
                  <td style={{ padding: "var(--space-3) var(--space-4)", fontWeight: c.parentId ? 400 : 600 }}>
                    {c.parentId ? "├ " : ""}{c.name}
                  </td>
                  <td style={{ padding: "var(--space-3) var(--space-4)" }}>
                    <span style={{ color: c.type === "INCOME" ? "var(--color-success)" : "var(--color-destructive)", fontWeight: 500 }}>
                      {c.type === "INCOME" ? "Thu" : "Chi"}
                    </span>
                  </td>
                  <td style={{ padding: "var(--space-3) var(--space-4)", color: "var(--color-foreground-muted)", fontSize: "var(--text-xs)" }}>
                    {parent?.name ?? "— (gốc)"}
                  </td>
                  <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}>
                    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: "var(--radius-sm)", fontSize: "var(--text-xs)", background: c.isActive ? "var(--color-success-bg)" : "var(--color-muted)", color: c.isActive ? "var(--color-success)" : "var(--color-foreground-muted)" }}>
                      {c.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

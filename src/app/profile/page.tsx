import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { role: { include: { permissions: { include: { permission: true } } } } },
  });
  if (!user) redirect("/login");

  return (
    <div style={{ maxWidth: 600 }}>
      <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, marginBottom: "var(--space-6)" }}>Hồ sơ người dùng</h1>

      <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "var(--space-6)", boxShadow: "var(--shadow-sm)", marginBottom: "var(--space-6)" }}>
        <Field label="Email" value={user.email} />
        <Field label="Tên" value={user.name} />
        <Field label="Vai trò" value={user.role?.name ?? "Không có"} />
        <Field label="Trạng thái" value={user.isActive ? "Đang hoạt động" : "Đã khóa"} />
      </div>

      <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 600, marginBottom: "var(--space-4)" }}>Quyền của bạn</h2>
      <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--color-border)", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-foreground-muted)", textTransform: "uppercase" }}>
              <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Mã quyền</th>
            </tr>
          </thead>
          <tbody>
            {user.role?.permissions.length === 0 ? (
              <tr><td style={{ padding: "var(--space-6)", textAlign: "center", color: "var(--color-foreground-muted)" }}>Không có quyền nào</td></tr>
            ) : user.role?.permissions.map((rp, i) => (
              <tr key={rp.permission.code} style={{ borderBottom: i < (user.role?.permissions.length ?? 0) - 1 ? "1px solid var(--color-muted)" : "none", background: i % 2 === 0 ? "var(--color-surface)" : "var(--color-surface-hover)" }}>
                <td style={{ padding: "var(--space-3) var(--space-4)", fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)" }}>{rp.permission.code}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: "var(--space-4)" }}>
      <div style={{ fontSize: "var(--text-xs)", color: "var(--color-foreground-muted)", fontWeight: 500, marginBottom: "var(--space-1)" }}>{label}</div>
      <div style={{ fontSize: "var(--text-base)", fontWeight: 500 }}>{value}</div>
    </div>
  );
}

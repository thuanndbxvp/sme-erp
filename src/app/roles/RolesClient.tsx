"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createRole, updateRolePermissions } from "@/app/actions/admin-actions";

/* eslint-disable @typescript-eslint/no-explicit-any */

const btnSm: React.CSSProperties = { fontSize: "var(--text-xs)", padding: "2px 8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-primary)", background: "transparent", color: "var(--color-primary)", cursor: "pointer" };

export default function RolesClient({ roles, permissions, users }: { roles: any[]; permissions: any[]; users: any[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [editPerms, setEditPerms] = useState<string | null>(null); // roleId being edited
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  function startEditPerms(role: any) {
    setEditPerms(role.id);
    setSelectedPerms(role.permissions.map((rp: any) => rp.permissionId));
  }

  function togglePerm(pid: string) {
    setSelectedPerms(prev => prev.includes(pid) ? prev.filter(p => p !== pid) : [...prev, pid]);
  }

  function savePerms(roleId: string) {
    setError(null);
    const fd = new FormData();
    fd.set("roleId", roleId);
    selectedPerms.forEach(p => fd.append("permissionIds", p));
    startTransition(async () => {
      const r = await updateRolePermissions(fd);
      if (r.ok) { setEditPerms(null); router.refresh(); }
      else setError(r.error);
    });
  }

  function createRoleAction(fd: FormData) {
    setError(null);
    startTransition(async () => {
      const r = await createRole(fd);
      if (r.ok) { setShowForm(false); router.refresh(); }
      else setError(r.error);
    });
  }

  const S: React.CSSProperties = { width: "100%", height: 40, padding: "0 10px", border: "1px solid var(--color-border-strong)", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", fontFamily: "var(--font-sans)" };
  const btn: React.CSSProperties = { height: 40, padding: "0 16px", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", fontWeight: 600, cursor: "pointer", border: "none", background: "var(--color-primary)", color: "white" };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-6)" }}>
        <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, margin: 0 }}>Phân quyền</h1>
        <button onClick={() => setShowForm(true)} style={btn}>+ Thêm vai trò</button>
      </div>

      {error && <div style={{ padding: "var(--space-3)", background: "var(--color-destructive-bg)", color: "var(--color-destructive)", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", marginBottom: "var(--space-4)" }}>{error}</div>}

      {/* Create role form */}
      {showForm && (
        <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "var(--space-5)", marginBottom: "var(--space-5)", maxWidth: 480 }}>
          <h3 style={{ fontWeight: 600, marginBottom: "var(--space-4)" }}>Tạo vai trò mới</h3>
          <form action={createRoleAction} style={{ display: "grid", gap: "var(--space-3)" }}>
            <input name="name" placeholder="Tên vai trò" style={S} required />
            <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-foreground-muted)" }}>Chọn quyền:</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-1)", maxHeight: 200, overflowY: "auto" }}>
              {permissions.map((p: any) => (
                <label key={p.id} style={{ fontSize: "var(--text-xs)", display: "flex", alignItems: "center", gap: 4 }}>
                  <input type="checkbox" name="permissionIds" value={p.id} /> {p.description || p.code}
                </label>
              ))}
            </div>
            <div style={{ display: "flex", gap: "var(--space-3)" }}>
              <button type="submit" disabled={pending} style={btn}>{pending ? "..." : "Tạo"}</button>
              <button type="button" onClick={() => setShowForm(false)} style={{ ...btn, background: "var(--color-surface)", color: "var(--color-foreground)", border: "1px solid var(--color-border-strong)" }}>Hủy</button>
            </div>
          </form>
        </div>
      )}

      {/* Roles table */}
      <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 600, marginBottom: "var(--space-3)" }}>Vai trò ({roles.length})</h2>
      <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", overflow: "hidden", boxShadow: "var(--shadow-sm)", marginBottom: "var(--space-8)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)" }}>
          <thead><tr style={{ borderBottom: "1px solid var(--color-border)", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-foreground-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Vai trò</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Quyền</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}>Users</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}></th>
          </tr></thead>
          <tbody>
            {roles.map((r: any, i: number) => (
              <tr key={r.id} style={{ borderBottom: i < roles.length - 1 ? "1px solid var(--color-muted)" : "none", background: i % 2 === 0 ? "var(--color-surface)" : "var(--color-surface-hover)" }}>
                <td style={{ padding: "var(--space-3) var(--space-4)", fontWeight: 600 }}>{r.name}</td>
                <td style={{ padding: "var(--space-3) var(--space-4)" }}>
                  {editPerms === r.id ? (
                    <div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-1)", marginBottom: "var(--space-2)" }}>
                        {permissions.map((p: any) => (
                          <label key={p.id} style={{ fontSize: "var(--text-xs)", display: "flex", alignItems: "center", gap: 3, padding: "2px 6px", borderRadius: "var(--radius-sm)", background: selectedPerms.includes(p.id) ? "var(--color-primary)" : "var(--color-muted)", color: selectedPerms.includes(p.id) ? "white" : "var(--color-foreground)" }}>
                            <input type="checkbox" checked={selectedPerms.includes(p.id)} onChange={() => togglePerm(p.id)} style={{ display: "none" }} /> {p.description || p.code}
                          </label>
                        ))}
                      </div>
                      <button onClick={() => savePerms(r.id)} disabled={pending} style={btnSm}>Lưu</button>
                      <button onClick={() => setEditPerms(null)} style={{ ...btnSm, borderColor: "var(--color-foreground-muted)", color: "var(--color-foreground-muted)", marginLeft: 4 }}>Hủy</button>
                    </div>
                  ) : (
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--color-foreground-muted)" }}>
                      {r.permissions.map((rp: any) => rp.permission.description || rp.permission.code).join(", ") || "—"}
                    </div>
                  )}
                </td>
                <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center", fontWeight: 600 }}>{r._count.users}</td>
                <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}>
                  {editPerms !== r.id && <button onClick={() => startEditPerms(r)} style={btnSm}>Sửa quyền</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Users */}
      <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 600, marginBottom: "var(--space-3)" }}>Người dùng ({users.length})</h2>
      <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)" }}>
          <thead><tr style={{ borderBottom: "1px solid var(--color-border)", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-foreground-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Tên</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Email</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Vai trò</th>
          </tr></thead>
          <tbody>
            {users.map((u: any, i: number) => (
              <tr key={u.id} style={{ borderBottom: i < users.length - 1 ? "1px solid var(--color-muted)" : "none", background: i % 2 === 0 ? "var(--color-surface)" : "var(--color-surface-hover)" }}>
                <td style={{ padding: "var(--space-3) var(--space-4)", fontWeight: 500 }}>{u.name}</td>
                <td style={{ padding: "var(--space-3) var(--space-4)", fontSize: "var(--text-xs)" }}>{u.email}</td>
                <td style={{ padding: "var(--space-3) var(--space-4)" }}>{u.role?.name ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

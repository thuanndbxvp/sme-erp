"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createUser, updateUser, deactivateUser, resetUserPassword } from "@/app/actions/admin-actions";

/* eslint-disable @typescript-eslint/no-explicit-any */

const S: React.CSSProperties = { width: "100%", height: 40, padding: "0 10px", border: "1px solid var(--color-border-strong)", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", fontFamily: "var(--font-sans)", background: "var(--color-surface)" };

export default function UsersClient({ users, roles }: { users: any[]; roles: any[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetPwUserId, setResetPwUserId] = useState<string | null>(null);
  const [newPw, setNewPw] = useState("");

  function onSubmit(fd: FormData) {
    setError(null);
    const action = editing ? updateUser : createUser;
    if (editing) fd.set("id", editing.id);
    startTransition(async () => {
      const r = await action(fd);
      if (r.ok) { setShowForm(false); setEditing(null); router.refresh(); }
      else setError(r.error);
    });
  }

  function doDeactivate(id: string) {
    if (!confirm("Bạn có chắc muốn khóa người dùng này?")) return;
    const fd = new FormData(); fd.set("id", id);
    startTransition(async () => { await deactivateUser(fd); router.refresh(); });
  }

  function doResetPw() {
    if (!resetPwUserId || newPw.length < 6) return;
    const fd = new FormData(); fd.set("id", resetPwUserId); fd.set("password", newPw);
    startTransition(async () => {
      const r = await resetUserPassword(fd);
      if (r.ok) { setResetPwUserId(null); setNewPw(""); router.refresh(); }
    });
  }

  return (
    <div>
      {!showForm ? (
        <button onClick={() => { setShowForm(true); setEditing(null); }} style={{ height: 40, padding: "0 16px", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", fontWeight: 600, cursor: "pointer", border: "none", background: "var(--color-primary)", color: "white", marginBottom: "var(--space-5)" }}>+ Thêm người dùng</button>
      ) : (
        <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "var(--space-5)", marginBottom: "var(--space-5)", maxWidth: 480 }}>
          <h3 style={{ fontSize: "var(--text-base)", fontWeight: 600, marginBottom: "var(--space-4)" }}>{editing ? "Sửa người dùng" : "Thêm người dùng"}</h3>
          {error && <div style={{ padding: "var(--space-2) var(--space-3)", background: "var(--color-destructive-bg)", color: "var(--color-destructive)", borderRadius: "var(--radius-sm)", fontSize: "var(--text-xs)", marginBottom: "var(--space-3)" }}>{error}</div>}
          <form action={onSubmit} style={{ display: "grid", gap: "var(--space-3)" }}>
            <input name="name" placeholder="Tên" defaultValue={editing?.name ?? ""} style={S} required />
            <input name="email" type="email" placeholder="Email" defaultValue={editing?.email ?? ""} style={S} required />
            <input name="password" type="password" placeholder={editing ? "Mật khẩu mới (để trống nếu không đổi)" : "Mật khẩu"} style={S} required={!editing} />
            <select name="roleId" defaultValue={editing?.roleId ?? ""} style={S}>
              <option value="">Không có vai trò</option>
              {roles.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            {editing && (
              <select name="isActive" defaultValue={editing?.isActive ? "true" : "false"} style={S}>
                <option value="true">Đang hoạt động</option>
                <option value="false">Đã khóa</option>
              </select>
            )}
            <div style={{ display: "flex", gap: "var(--space-3)" }}>
              <button type="submit" disabled={pending} style={{ height: 40, padding: "0 16px", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", fontWeight: 600, cursor: "pointer", border: "none", background: "var(--color-primary)", color: "white" }}>{pending ? "Đang lưu..." : "Lưu"}</button>
              <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} style={{ height: 40, padding: "0 16px", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", fontWeight: 600, cursor: "pointer", border: "1px solid var(--color-border-strong)", background: "var(--color-surface)", color: "var(--color-foreground)" }}>Hủy</button>
            </div>
          </form>
        </div>
      )}

      {/* Reset password modal */}
      {resetPwUserId && (
        <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "var(--space-5)", marginBottom: "var(--space-5)", maxWidth: 400 }}>
          <h3 style={{ fontWeight: 600, marginBottom: "var(--space-4)" }}>Đổi mật khẩu</h3>
          <div style={{ display: "grid", gap: "var(--space-3)" }}>
            <input type="password" placeholder="Mật khẩu mới (min 6 ký tự)" value={newPw} onChange={e => setNewPw(e.target.value)} style={S} />
            <div style={{ display: "flex", gap: "var(--space-3)" }}>
              <button onClick={doResetPw} disabled={pending || newPw.length < 6} style={{ height: 40, padding: "0 16px", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", fontWeight: 600, cursor: "pointer", border: "none", background: "var(--color-primary)", color: "white" }}>Lưu</button>
              <button onClick={() => { setResetPwUserId(null); setNewPw(""); }} style={{ height: 40, padding: "0 16px", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", fontWeight: 600, cursor: "pointer", border: "1px solid var(--color-border-strong)", background: "var(--color-surface)", color: "var(--color-foreground)" }}>Hủy</button>
            </div>
          </div>
        </div>
      )}

      {/* User table */}
      <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)" }}>
          <thead><tr style={{ borderBottom: "1px solid var(--color-border)", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-foreground-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Tên</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Email</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Vai trò</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}>TT</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}>Thao tác</th>
          </tr></thead>
          <tbody>
            {users.map((u: any, i: number) => (
              <tr key={u.id} style={{ borderBottom: i < users.length - 1 ? "1px solid var(--color-muted)" : "none", background: i % 2 === 0 ? "var(--color-surface)" : "var(--color-surface-hover)" }}>
                <td style={{ padding: "var(--space-3) var(--space-4)", fontWeight: 500 }}>{u.name}</td>
                <td style={{ padding: "var(--space-3) var(--space-4)", fontSize: "var(--text-xs)" }}>{u.email}</td>
                <td style={{ padding: "var(--space-3) var(--space-4)" }}>{u.role?.name ?? "—"}</td>
                <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}>
                  <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: "var(--radius-sm)", fontSize: "var(--text-xs)", background: u.isActive ? "var(--color-success-bg)" : "var(--color-muted)", color: u.isActive ? "var(--color-success)" : "var(--color-foreground-muted)" }}>{u.isActive ? "Active" : "Khóa"}</span>
                </td>
                <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center", whiteSpace: "nowrap" }}>
                  <button onClick={() => { setEditing(u); setShowForm(true); }} style={{ fontSize: "var(--text-xs)", padding: "2px 8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-primary)", background: "transparent", color: "var(--color-primary)", cursor: "pointer" }}>Sửa</button>
                  <button onClick={() => { setResetPwUserId(u.id); setNewPw(""); }} style={{ fontSize: "var(--text-xs)", padding: "2px 8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-warning)", background: "transparent", color: "var(--color-warning)", cursor: "pointer", marginLeft: 4 }}>Đổi MK</button>
                  {u.isActive && <button onClick={() => doDeactivate(u.id)} disabled={pending} style={{ fontSize: "var(--text-xs)", padding: "2px 8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-destructive)", background: "transparent", color: "var(--color-destructive)", cursor: "pointer", marginLeft: 4 }}>Khóa</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createUser, updateUser, deactivateUser, resetUserPassword, deleteUser } from "@/app/actions/admin-actions";

/* eslint-disable @typescript-eslint/no-explicit-any */

const S: React.CSSProperties = { width: "100%", height: 40, padding: "0 10px", border: "1px solid var(--color-border-strong)", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", fontFamily: "var(--font-sans)", background: "var(--color-surface)" };
const pageSize = 20;

// Inline style cho overlay modal (MSEW Bước 3.2)
const modalOverlay: React.CSSProperties = { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 };
const modalBox: React.CSSProperties = { background: "white", padding: 24, borderRadius: 8, width: 400, maxWidth: "92vw", maxHeight: "90vh", overflowY: "auto" };

export default function UsersClient({ users, roles }: { users: any[]; roles: any[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetPwUserId, setResetPwUserId] = useState<string | null>(null);
  const [newPw, setNewPw] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(users.length / pageSize);
  const displayUsers = users.slice((currentPage - 1) * pageSize, currentPage * pageSize);

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

  /**
   * Xóa cứng user (MSEW Bước 3.3). Có confirm() trước. Nếu user đã phát sinh
   * giao dịch, server trả ok=false → hiển thị lỗi thân thiện.
   */
  function doDelete(id: string, name: string) {
    if (!confirm(`Chắc chắn XÓA người dùng "${name}"?\n\nNếu user đã từng tạo đơn hàng, hệ thống sẽ từ chối và yêu cầu Khóa thay thế.`)) return;
    const fd = new FormData(); fd.set("id", id);
    startTransition(async () => {
      const r = await deleteUser(fd);
      if (r.ok) {
        router.refresh();
      } else {
        alert(r.error);
      }
    });
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
      <button onClick={() => { setShowForm(true); setEditing(null); setError(null); }} style={{ height: 40, padding: "0 16px", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", fontWeight: 600, cursor: "pointer", border: "none", background: "var(--color-primary)", color: "white", marginBottom: "var(--space-5)" }}>+ Thêm người dùng</button>

      {/* Form Thêm/Sửa dưới dạng Fixed Modal ở cuối component (MSEW Bước 3.2) */}
      {showForm && (
        <div style={modalOverlay} onClick={() => { setShowForm(false); setEditing(null); setError(null); }}>
          <div style={modalBox} onClick={(e) => e.stopPropagation()}>
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
              <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-2)" }}>
                <button type="submit" disabled={pending} style={{ height: 40, padding: "0 16px", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", fontWeight: 600, cursor: "pointer", border: "none", background: "var(--color-primary)", color: "white" }}>{pending ? "Đang lưu..." : "Lưu"}</button>
                <button type="button" onClick={() => { setShowForm(false); setEditing(null); setError(null); }} style={{ height: 40, padding: "0 16px", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", fontWeight: 600, cursor: "pointer", border: "1px solid var(--color-border-strong)", background: "var(--color-surface)", color: "var(--color-foreground)" }}>Hủy</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset password modal */}
      {resetPwUserId && (
        <div style={modalOverlay} onClick={() => { setResetPwUserId(null); setNewPw(""); }}>
          <div style={modalBox} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontWeight: 600, marginBottom: "var(--space-4)" }}>Đổi mật khẩu</h3>
            <div style={{ display: "grid", gap: "var(--space-3)" }}>
              <input type="password" placeholder="Mật khẩu mới (min 6 ký tự)" value={newPw} onChange={e => setNewPw(e.target.value)} style={S} />
              <div style={{ display: "flex", gap: "var(--space-3)" }}>
                <button onClick={doResetPw} disabled={pending || newPw.length < 6} style={{ height: 40, padding: "0 16px", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", fontWeight: 600, cursor: "pointer", border: "none", background: "var(--color-primary)", color: "white" }}>Lưu</button>
                <button onClick={() => { setResetPwUserId(null); setNewPw(""); }} style={{ height: 40, padding: "0 16px", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", fontWeight: 600, cursor: "pointer", border: "1px solid var(--color-border-strong)", background: "var(--color-surface)", color: "var(--color-foreground)" }}>Hủy</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User table */}
      <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)" }}>
          <thead><tr style={{ borderBottom: "1px solid var(--color-border)", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-foreground-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center", width: 50 }}>STT</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Tên</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Email</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Vai trò</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}>TT</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}>Thao tác</th>
          </tr></thead>
          <tbody>
            {displayUsers.map((u: any, i: number) => (
              <tr key={u.id} style={{ borderBottom: i < displayUsers.length - 1 ? "1px solid var(--color-muted)" : "none", background: i % 2 === 0 ? "var(--color-surface)" : "var(--color-surface-hover)" }}>
                <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}>{(currentPage - 1) * pageSize + i + 1}</td>
                <td style={{ padding: "var(--space-3) var(--space-4)", fontWeight: 500 }}>{u.name}</td>
                <td style={{ padding: "var(--space-3) var(--space-4)", fontSize: "var(--text-xs)" }}>{u.email}</td>
                <td style={{ padding: "var(--space-3) var(--space-4)" }}>{u.role?.name ?? "—"}</td>
                <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}>
                  <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: "var(--radius-sm)", fontSize: "var(--text-xs)", background: u.isActive ? "var(--color-success-bg)" : "var(--color-muted)", color: u.isActive ? "var(--color-success)" : "var(--color-foreground-muted)" }}>{u.isActive ? "Active" : "Khóa"}</span>
                </td>
                <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center", whiteSpace: "nowrap" }}>
                  <button onClick={() => { setEditing(u); setShowForm(true); setError(null); }} style={{ fontSize: "var(--text-xs)", padding: "2px 8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-primary)", background: "transparent", color: "var(--color-primary)", cursor: "pointer" }}>Sửa</button>
                  <button onClick={() => { setResetPwUserId(u.id); setNewPw(""); }} style={{ fontSize: "var(--text-xs)", padding: "2px 8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-warning)", background: "transparent", color: "var(--color-warning)", cursor: "pointer", marginLeft: 4 }}>Đổi MK</button>
                  {u.isActive && <button onClick={() => doDeactivate(u.id)} disabled={pending} style={{ fontSize: "var(--text-xs)", padding: "2px 8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-destructive)", background: "transparent", color: "var(--color-destructive)", cursor: "pointer", marginLeft: 4 }}>Khóa</button>}
                  <button onClick={() => doDelete(u.id, u.name)} disabled={pending} style={{ fontSize: "var(--text-xs)", padding: "2px 8px", borderRadius: "var(--radius-sm)", border: "1px solid #B91C1C", background: "transparent", color: "#B91C1C", cursor: "pointer", marginLeft: 4, fontWeight: 700 }}>Xóa</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "var(--space-2)", padding: "var(--space-3)", borderTop: "1px solid var(--color-border)" }}>
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} style={{ padding: "var(--space-1) var(--space-3)", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)", background: "var(--color-surface)", cursor: currentPage === 1 ? "not-allowed" : "pointer", opacity: currentPage === 1 ? 0.5 : 1 }}>‹</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button key={p} onClick={() => setCurrentPage(p)} style={{ padding: "var(--space-1) var(--space-2)", minWidth: 32, borderRadius: "var(--radius-sm)", border: "1px solid", borderColor: p === currentPage ? "var(--color-primary)" : "var(--color-border)", background: p === currentPage ? "var(--color-primary)" : "var(--color-surface)", color: p === currentPage ? "white" : "var(--color-foreground)", cursor: "pointer", fontSize: "var(--text-xs)" }}>{p}</button>
            ))}
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} style={{ padding: "var(--space-1) var(--space-3)", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)", background: "var(--color-surface)", cursor: currentPage === totalPages ? "not-allowed" : "pointer", opacity: currentPage === totalPages ? 0.5 : 1 }}>›</button>
          </div>
        )}
      </div>
    </div>
  );
}
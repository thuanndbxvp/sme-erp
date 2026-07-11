"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateOwnProfile } from "@/app/actions/admin-actions";

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function ProfileClient({ user }: { user: any }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const [newPw, setNewPw] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  function onSubmit() {
    setMsg(null);
    const fd = new FormData();
    fd.set("name", name);
    if (newPw && newPw.length >= 6) fd.set("password", newPw);
    startTransition(async () => {
      const r = await updateOwnProfile(fd);
      if (r.ok) { setMsg("Đã cập nhật!"); setEditing(false); setNewPw(""); router.refresh(); }
      else setMsg(r.error);
    });
  }

  const S: React.CSSProperties = { width: "100%", height: 40, padding: "0 10px", border: "1px solid var(--color-border-strong)", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", fontFamily: "var(--font-sans)", background: "var(--color-surface)" };

  return (
    <div style={{ maxWidth: 600 }}>
      <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, marginBottom: "var(--space-6)" }}>Hồ sơ người dùng</h1>

      {msg && <div style={{ padding: "var(--space-3)", background: msg.includes("Đã") ? "var(--color-success-bg)" : "var(--color-destructive-bg)", color: msg.includes("Đã") ? "var(--color-success)" : "var(--color-destructive)", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", marginBottom: "var(--space-4)" }}>{msg}</div>}

      <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "var(--space-6)", boxShadow: "var(--shadow-sm)", marginBottom: "var(--space-6)" }}>
        {!editing ? (
          <>
            <Field label="Email" value={user.email} />
            <Field label="Tên" value={user.name} />
            <Field label="Vai trò" value={user.role?.name ?? "Không có"} />
            <Field label="Trạng thái" value={user.isActive ? "Đang hoạt động" : "Đã khóa"} />
            <button onClick={() => setEditing(true)} style={{ marginTop: "var(--space-4)", height: 40, padding: "0 16px", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", fontWeight: 600, cursor: "pointer", border: "none", background: "var(--color-primary)", color: "white" }}>Chỉnh sửa</button>
          </>
        ) : (
          <div style={{ display: "grid", gap: "var(--space-4)" }}>
            <div>
              <label style={{ fontSize: "var(--text-xs)", fontWeight: 600, display: "block", marginBottom: 2 }}>Email (không đổi được)</label>
              <input value={user.email} disabled style={{ ...S, background: "var(--color-muted)", color: "var(--color-foreground-muted)" }} />
            </div>
            <div>
              <label style={{ fontSize: "var(--text-xs)", fontWeight: 600, display: "block", marginBottom: 2 }}>Tên</label>
              <input value={name} onChange={e => setName(e.target.value)} style={S} />
            </div>
            <div>
              <label style={{ fontSize: "var(--text-xs)", fontWeight: 600, display: "block", marginBottom: 2 }}>Mật khẩu mới (để trống nếu không đổi)</label>
              <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Tối thiểu 6 ký tự" style={S} />
            </div>
            <div style={{ display: "flex", gap: "var(--space-3)" }}>
              <button onClick={onSubmit} disabled={pending} style={{ height: 40, padding: "0 16px", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", fontWeight: 600, cursor: "pointer", border: "none", background: "var(--color-primary)", color: "white" }}>{pending ? "..." : "Lưu thay đổi"}</button>
              <button onClick={() => setEditing(false)} style={{ height: 40, padding: "0 16px", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", fontWeight: 600, cursor: "pointer", border: "1px solid var(--color-border-strong)", background: "var(--color-surface)", color: "var(--color-foreground)" }}>Hủy</button>
            </div>
          </div>
        )}
      </div>

      <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 600, marginBottom: "var(--space-4)" }}>Quyền của bạn</h2>
      <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)" }}>
          <thead><tr style={{ borderBottom: "1px solid var(--color-border)", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-foreground-muted)", textTransform: "uppercase" }}>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Mã quyền</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Mô tả</th>
          </tr></thead>
          <tbody>
            {user.role?.permissions.length === 0 ? (
              <tr><td colSpan={2} style={{ padding: "var(--space-6)", textAlign: "center", color: "var(--color-foreground-muted)" }}>Không có quyền nào</td></tr>
            ) : user.role?.permissions.map((rp: any, i: number) => (
              <tr key={rp.permission.code} style={{ borderBottom: i < (user.role?.permissions.length ?? 0) - 1 ? "1px solid var(--color-muted)" : "none", background: i % 2 === 0 ? "var(--color-surface)" : "var(--color-surface-hover)" }}>
                <td style={{ padding: "var(--space-3) var(--space-4)", fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)" }}>{rp.permission.code}</td>
                <td style={{ padding: "var(--space-3) var(--space-4)", fontSize: "var(--text-sm)" }}>{rp.permission.description || rp.permission.code}</td>
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

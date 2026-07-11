"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTransactionCategory } from "@/app/actions/admin-actions";

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function FinanceClient({ accounts, categories }: { accounts: any[]; categories: any[] }) {
  const [tab, setTab] = useState<"accounts" | "categories">("accounts");

  return (
    <div>
      <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, marginBottom: "var(--space-5)" }}>Tài chính</h1>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: "var(--space-5)", borderBottom: "2px solid var(--color-border)" }}>
        <TabBtn active={tab === "accounts"} onClick={() => setTab("accounts")} label={`🏦 Tài khoản tiền (${accounts.length})`} />
        <TabBtn active={tab === "categories"} onClick={() => setTab("categories")} label={`🏷️ Phân loại dòng tiền (${categories.length})`} />
      </div>

      {tab === "accounts" ? (
        <AccountsTab accounts={accounts} />
      ) : (
        <CategoriesTab categories={categories} />
      )}
    </div>
  );
}

function TabBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} style={{
      padding: "var(--space-3) var(--space-5)", background: "none", border: "none",
      borderBottom: active ? "2px solid var(--color-primary)" : "2px solid transparent", marginBottom: -2,
      fontWeight: active ? 600 : 400, color: active ? "var(--color-primary)" : "var(--color-foreground-muted)",
      fontSize: "var(--text-sm)", cursor: "pointer",
    }}>{label}</button>
  );
}

function AccountsTab({ accounts }: { accounts: any[] }) {
  return (
    <div>
      {/* Balance summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "var(--space-4)", marginBottom: "var(--space-5)" }}>
        <div style={{ background: "var(--color-primary)10", border: "2px solid var(--color-primary)", borderRadius: "var(--radius-lg)", padding: "var(--space-4)" }}>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--color-primary)", fontWeight: 700, textTransform: "uppercase" }}>Tổng số dư</div>
          <div style={{ fontSize: "var(--text-2xl)", fontWeight: 800, color: "var(--color-primary)", marginTop: "var(--space-1)" }}>
            {accounts.reduce((s: number, a: any) => s + Number(a.balance), 0).toLocaleString("vi-VN")} đ
          </div>
        </div>
        {accounts.map((a: any) => (
          <div key={a.id} style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "var(--space-4)" }}>
            <div style={{ fontWeight: 700, fontSize: "var(--text-base)", marginBottom: "var(--space-2)" }}>{a.code} — {a.name}</div>
            <div style={{ fontSize: "var(--text-sm)", color: "var(--color-foreground-muted)" }}>Số dư: <strong style={{ color: Number(a.balance) >= 0 ? "var(--color-success)" : "var(--color-destructive)" }}>{Number(a.balance).toLocaleString("vi-VN")} đ</strong></div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--color-foreground-muted)", marginTop: 2 }}>{a.isActive ? "✅ Đang hoạt động" : "⛔ Đã khóa"}</div>
          </div>
        ))}
      </div>

      {/* Accounts table */}
      <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)", fontVariantNumeric: "tabular-nums" }}>
          <thead><tr style={{ borderBottom: "1px solid var(--color-border)", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-foreground-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Mã</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Tên</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>Số dư</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}>Trạng thái</th>
          </tr></thead>
          <tbody>
            {accounts.map((a: any, i: number) => (
              <tr key={a.id} style={{ borderBottom: i < accounts.length - 1 ? "1px solid var(--color-muted)" : "none", background: i % 2 === 0 ? "var(--color-surface)" : "var(--color-surface-hover)" }}>
                <td style={{ padding: "var(--space-3) var(--space-4)", fontFamily: "var(--font-mono)", fontWeight: 600 }}>{a.code}</td>
                <td style={{ padding: "var(--space-3) var(--space-4)" }}>{a.name}</td>
                <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right", fontWeight: 700, color: Number(a.balance) >= 0 ? "var(--color-success)" : "var(--color-destructive)" }}>{Number(a.balance).toLocaleString("vi-VN")} đ</td>
                <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}><span style={{ padding: "2px 8px", borderRadius: "var(--radius-sm)", fontSize: "var(--text-xs)", fontWeight: 600, background: a.isActive ? "var(--color-success-bg)" : "var(--color-muted)", color: a.isActive ? "var(--color-success)" : "var(--color-foreground-muted)" }}>{a.isActive ? "Active" : "Khóa"}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CategoriesTab({ categories }: { categories: any[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [parentId, setParentId] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const roots = categories.filter((c: any) => !c.parentId);
  const children = (pid: string) => categories.filter((c: any) => c.parentId === pid);

  function onSubmit(fd: FormData) {
    setMsg(null);
    startTransition(async () => {
      const r = await createTransactionCategory(fd);
      if (r.ok) { setShowForm(false); setMsg("Đã tạo!"); router.refresh(); }
      else setMsg(r.error);
    });
  }

  const S: React.CSSProperties = { width: "100%", height: 40, padding: "0 10px", border: "1px solid var(--color-border-strong)", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", fontFamily: "var(--font-sans)", background: "var(--color-surface)" };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-4)" }}>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--color-foreground-muted)", margin: 0 }}>2 danh mục gốc · {categories.length - 2} danh mục con</p>
        <button onClick={() => setShowForm(!showForm)} style={{ height: 36, padding: "0 14px", borderRadius: "var(--radius-md)", fontSize: "var(--text-xs)", fontWeight: 600, cursor: "pointer", border: "none", background: "var(--color-primary)", color: "white" }}>+ Thêm danh mục con</button>
      </div>

      {msg && <div style={{ padding: "var(--space-2) var(--space-3)", background: msg.includes("Đã") ? "var(--color-success-bg)" : "var(--color-destructive-bg)", color: msg.includes("Đã") ? "var(--color-success)" : "var(--color-destructive)", borderRadius: "var(--radius-sm)", fontSize: "var(--text-xs)", marginBottom: "var(--space-4)" }}>{msg}</div>}

      {showForm && (
        <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "var(--space-5)", marginBottom: "var(--space-4)", maxWidth: 480 }}>
          <form action={onSubmit} style={{ display: "grid", gap: "var(--space-3)" }}>
            <select value={parentId} onChange={e => setParentId(e.target.value)} style={S}>
              <option value="">-- Chọn danh mục cha --</option>
              {roots.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <input type="hidden" name="parentId" value={parentId} />
            <input name="name" placeholder="Tên danh mục con" style={S} required />
            <input type="hidden" name="type" value="ALL" />
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <button type="submit" disabled={pending} style={{ height: 36, padding: "0 14px", borderRadius: "var(--radius-sm)", fontSize: "var(--text-sm)", fontWeight: 600, cursor: "pointer", border: "none", background: "var(--color-primary)", color: "white" }}>{pending ? "..." : "Tạo"}</button>
              <button type="button" onClick={() => setShowForm(false)} style={{ height: 36, padding: "0 14px", borderRadius: "var(--radius-sm)", fontSize: "var(--text-sm)", fontWeight: 600, cursor: "pointer", border: "1px solid var(--color-border-strong)", background: "var(--color-surface)" }}>Hủy</button>
            </div>
          </form>
        </div>
      )}

      {roots.map((root: any) => (
        <div key={root.id} style={{ marginBottom: "var(--space-5)" }}>
          <h2 style={{ fontSize: "var(--text-base)", fontWeight: 700, color: "var(--color-primary)", marginBottom: "var(--space-3)", padding: "var(--space-3)", background: "var(--color-primary)10", borderRadius: "var(--radius-md)" }}>
            📁 {root.name} <span style={{ fontSize: "var(--text-xs)", color: "var(--color-foreground-muted)", fontWeight: 400 }}>({children(root.id).length} con)</span>
          </h2>
          {children(root.id).length === 0 ? (
            <div style={{ fontSize: "var(--text-sm)", color: "var(--color-foreground-muted)", padding: "var(--space-2) var(--space-4)" }}>Chưa có danh mục con</div>
          ) : (
            <div style={{ display: "grid", gap: "var(--space-2)", marginLeft: "var(--space-4)" }}>
              {children(root.id).map((child: any) => (
                <div key={child.id} style={{ padding: "var(--space-2) var(--space-4)", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", display: "flex", justifyContent: "space-between" }}>
                  <span>📄 {child.name}</span>
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--color-foreground-muted)" }}>{child.isActive ? "Active" : "Inactive"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

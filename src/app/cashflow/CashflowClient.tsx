"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordTransaction } from "@/app/actions/order-actions";
import { createTransactionCategory } from "@/app/actions/admin-actions";

/* eslint-disable @typescript-eslint/no-explicit-any */

const S: React.CSSProperties = { width: "100%", height: 40, padding: "0 10px", border: "1px solid var(--color-border-strong)", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", fontFamily: "var(--font-sans)", background: "var(--color-surface)" };
const btn: React.CSSProperties = { height: 40, padding: "0 16px", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", fontWeight: 600, cursor: "pointer", border: "none", background: "var(--color-primary)", color: "white" };

export default function CashflowClient({ accounts, transactions, categories }: { accounts: any[]; transactions: any[]; categories: any[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<"cashflow" | "accounts" | "categories">("cashflow");

  return (
    <div>
      <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, marginBottom: 0 }}>Tài chính</h1>
      <p style={{ fontSize: "var(--text-sm)", color: "var(--color-foreground-muted)", marginBottom: "var(--space-5)", marginTop: "var(--space-1)" }}>
        {accounts.length} tài khoản · {transactions.length} giao dịch · {categories.length} phân loại
      </p>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: "var(--space-5)", borderBottom: "2px solid var(--color-border)" }}>
        <TabBtn active={tab === "cashflow"} onClick={() => setTab("cashflow")} label="💵 Sổ quỹ" />
        <TabBtn active={tab === "accounts"} onClick={() => setTab("accounts")} label="🏦 Tài khoản" />
        <TabBtn active={tab === "categories"} onClick={() => setTab("categories")} label="🏷️ Phân loại" />
      </div>

      {tab === "cashflow" && <CashflowTab accounts={accounts} transactions={transactions} categories={categories} router={router} />}
      {tab === "accounts" && <AccountsTab accounts={accounts} />}
      {tab === "categories" && <CategoriesTab categories={categories} router={router} />}
    </div>
  );
}

function TabBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return <button onClick={onClick} style={{ padding: "var(--space-3) var(--space-5)", background: "none", border: "none", borderBottom: active ? "2px solid var(--color-primary)" : "2px solid transparent", marginBottom: -2, fontWeight: active ? 600 : 400, color: active ? "var(--color-primary)" : "var(--color-foreground-muted)", fontSize: "var(--text-sm)", cursor: "pointer" }}>{label}</button>;
}

/* ====== SỔ QUỸ TAB ====== */
function CashflowTab({ accounts, transactions, categories, router }: { accounts: any[]; transactions: any[]; categories: any[]; router: any }) {
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const roots = categories.filter((c: any) => !c.parentId);
  const children = (pid: string) => categories.filter((c: any) => c.parentId === pid);

  function onSubmit(fd: FormData) {
    setError(null);
    startTransition(async () => { const r = await recordTransaction(fd); if (r.ok) { setShowForm(false); router.refresh(); } else setError(r.error); });
  }

  const summary = accounts.map((a: any) => {
    const txs = transactions.filter((t: any) => t.accountId === a.id);
    const inc = txs.filter((t: any) => t.type === "INCOME").reduce((s: number, t: any) => s + Number(t.amount), 0);
    const exp = txs.filter((t: any) => t.type === "EXPENSE").reduce((s: number, t: any) => s + Number(t.amount), 0);
    return { ...a, income: inc, expense: exp };
  });

  const totalBal = summary.reduce((s: number, a: any) => s + Number(a.balance), 0);
  const totalInc = summary.reduce((s: number, a: any) => s + a.income, 0);
  const totalExp = summary.reduce((s: number, a: any) => s + a.expense, 0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "var(--space-4)" }}>
        <button onClick={() => setShowForm(!showForm)} style={btn}>+ Ghi nhận</button>
      </div>

      {showForm && (
        <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "var(--space-5)", marginBottom: "var(--space-4)", maxWidth: 520 }}>
          {error && <div style={{ padding: "var(--space-2)", background: "var(--color-destructive-bg)", color: "var(--color-destructive)", borderRadius: "var(--radius-sm)", fontSize: "var(--text-xs)", marginBottom: "var(--space-3)" }}>{error}</div>}
          <form action={onSubmit} style={{ display: "grid", gap: "var(--space-3)" }}>
            <div>
              <label style={{ fontSize: "var(--text-xs)", fontWeight: 600, display: "block", marginBottom: 2 }}>Phân loại *</label>
              <select name="categoryId" style={S} required>
                <option value="">-- Chọn --</option>
                {roots.map((r: any) => (
                  <optgroup key={r.id} label={r.name}>
                    <option value={r.id}>{r.name} (chung)</option>
                    {children(r.id).map((c: any) => <option key={c.id} value={c.id}>  {c.name}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            <select name="type" style={S}><option value="INCOME">Thu vào</option><option value="EXPENSE">Chi ra</option></select>
            <input name="amount" type="number" step="0.01" placeholder="Số tiền" style={S} required />
            <select name="accountId" style={S}>{accounts.map((a: any) => <option key={a.id} value={a.id}>{a.code} — {a.name} ({(Number(a.balance)||0).toLocaleString("vi-VN")} đ)</option>)}</select>
            <input name="description" placeholder="Diễn giải" style={S} />
            <div style={{ display: "flex", gap: "var(--space-3)" }}>
              <button type="submit" disabled={pending} style={btn}>{pending ? "..." : "Ghi nhận"}</button>
              <button type="button" onClick={() => setShowForm(false)} style={{ ...btn, background: "var(--color-surface)", color: "var(--color-foreground)", border: "1px solid var(--color-border-strong)" }}>Hủy</button>
            </div>
          </form>
        </div>
      )}

      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "var(--space-4)", marginBottom: "var(--space-5)" }}>
        <div style={{ background: "var(--color-primary)10", border: "2px solid var(--color-primary)", borderRadius: "var(--radius-lg)", padding: "var(--space-4)" }}>
          <div style={{ fontWeight: 800, fontSize: "var(--text-sm)", marginBottom: "var(--space-3)", color: "var(--color-primary)", textTransform: "uppercase" }}>TỔNG QUỸ</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-2)", fontSize: "var(--text-sm)", marginBottom: "var(--space-3)" }}>
            <div><span style={{ color: "var(--color-foreground-subtle)", fontSize: "var(--text-xs)" }}>Thu</span><br /><span style={{ color: "var(--color-success)", fontWeight: 600 }}>{totalInc.toLocaleString("vi-VN")}</span></div>
            <div><span style={{ color: "var(--color-foreground-subtle)", fontSize: "var(--text-xs)" }}>Chi</span><br /><span style={{ color: "var(--color-destructive)", fontWeight: 600 }}>{totalExp.toLocaleString("vi-VN")}</span></div>
          </div>
          <div style={{ borderTop: "1px solid var(--color-primary)30", paddingTop: "var(--space-2)" }}>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--color-primary)", fontWeight: 600 }}>SỐ DƯ</span><br />
            <span style={{ fontWeight: 800, color: "var(--color-primary)", fontSize: "var(--text-2xl)" }}>{totalBal.toLocaleString("vi-VN")} đ</span>
          </div>
        </div>
        {summary.map((a: any) => (
          <div key={a.id} style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "var(--space-4)" }}>
            <div style={{ fontWeight: 700, fontSize: "var(--text-sm)", marginBottom: "var(--space-2)" }}>{a.code} — {a.name}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-1)", fontSize: "var(--text-xs)" }}>
              <div><span style={{ color: "var(--color-foreground-subtle)" }}>Thu</span><br /><span style={{ color: "var(--color-success)", fontWeight: 600 }}>{a.income.toLocaleString("vi-VN")}</span></div>
              <div><span style={{ color: "var(--color-foreground-subtle)" }}>Chi</span><br /><span style={{ color: "var(--color-destructive)", fontWeight: 600 }}>{a.expense.toLocaleString("vi-VN")}</span></div>
            </div>
            <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: "var(--space-1)", marginTop: "var(--space-2)" }}>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--color-foreground-subtle)" }}>Số dư</span><br />
              <span style={{ fontWeight: 700, fontSize: "var(--text-base)" }}>{Number(a.balance).toLocaleString("vi-VN")} đ</span>
            </div>
          </div>
        ))}
      </div>

      {/* Transaction list */}
      <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
        <div style={{ maxHeight: 400, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 1, background: "var(--color-surface)" }}><tr style={{ borderBottom: "1px solid var(--color-border)", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-foreground-muted)", textTransform: "uppercase" }}>
              <th style={{ padding: "var(--space-2) var(--space-3)", textAlign: "left" }}>Ngày</th><th style={{ padding: "var(--space-2) var(--space-3)", textAlign: "left" }}>TK</th><th style={{ padding: "var(--space-2) var(--space-3)", textAlign: "right" }}>Số tiền</th><th style={{ padding: "var(--space-2) var(--space-3)", textAlign: "left" }}>Diễn giải</th>
            </tr></thead>
            <tbody>
              {transactions.length === 0 ? <tr><td colSpan={4} style={{ padding: "var(--space-6)", textAlign: "center", color: "var(--color-foreground-muted)" }}>Chưa có giao dịch</td></tr> :
                transactions.slice(0, 150).map((t: any, i: number) => (
                  <tr key={t.id} style={{ borderBottom: i < Math.min(transactions.length, 150) - 1 ? "1px solid var(--color-muted)" : "none", background: i % 2 === 0 ? "var(--color-surface)" : "var(--color-surface-hover)" }}>
                    <td style={{ padding: "var(--space-2) var(--space-3)", whiteSpace: "nowrap" }}>{new Date(t.date).toLocaleDateString("vi-VN")}</td>
                    <td style={{ padding: "var(--space-2) var(--space-3)" }}>{t.account.code}</td>
                    <td style={{ padding: "var(--space-2) var(--space-3)", textAlign: "right", fontWeight: 600, color: t.type === "INCOME" ? "var(--color-success)" : "var(--color-destructive)" }}>{t.type === "INCOME" ? "+" : "−"}{Number(t.amount).toLocaleString("vi-VN")} đ</td>
                    <td style={{ padding: "var(--space-2) var(--space-3)", fontSize: "var(--text-xs)", color: "var(--color-foreground-muted)" }}>{t.description ?? ""}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ====== TÀI KHOẢN TAB ====== */
function AccountsTab({ accounts }: { accounts: any[] }) {
  const totalBal = accounts.reduce((s: number, a: any) => s + Number(a.balance), 0);
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "var(--space-4)", marginBottom: "var(--space-5)" }}>
        <div style={{ background: "var(--color-primary)10", border: "2px solid var(--color-primary)", borderRadius: "var(--radius-lg)", padding: "var(--space-4)" }}>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--color-primary)", fontWeight: 700, textTransform: "uppercase" }}>Tổng số dư</div>
          <div style={{ fontSize: "var(--text-2xl)", fontWeight: 800, color: "var(--color-primary)", marginTop: "var(--space-1)" }}>{totalBal.toLocaleString("vi-VN")} đ</div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--color-foreground-muted)", marginTop: 2 }}>{accounts.length} tài khoản</div>
        </div>
        {accounts.map((a: any) => (
          <div key={a.id} style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "var(--space-4)" }}>
            <div style={{ fontWeight: 700, fontSize: "var(--text-base)", marginBottom: "var(--space-1)" }}>{a.code} — {a.name}</div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "var(--space-2)" }}>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--color-foreground-muted)" }}>Số dư</span>
              <span style={{ fontWeight: 700, color: Number(a.balance) >= 0 ? "var(--color-success)" : "var(--color-destructive)" }}>{Number(a.balance).toLocaleString("vi-VN")} đ</span>
            </div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--color-foreground-muted)", marginTop: 2 }}>{a.isActive ? "✅ Hoạt động" : "⛔ Đã khóa"}</div>
          </div>
        ))}
      </div>

      <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)" }}>
          <thead><tr style={{ borderBottom: "1px solid var(--color-border)", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-foreground-muted)", textTransform: "uppercase" }}>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Mã</th><th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Tên</th><th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>Số dư</th><th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}>TT</th>
          </tr></thead>
          <tbody>
            {accounts.map((a: any, i: number) => (
              <tr key={a.id} style={{ borderBottom: i < accounts.length - 1 ? "1px solid var(--color-muted)" : "none", background: i % 2 === 0 ? "var(--color-surface)" : "var(--color-surface-hover)" }}>
                <td style={{ padding: "var(--space-3) var(--space-4)", fontWeight: 600, fontFamily: "var(--font-mono)" }}>{a.code}</td>
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

/* ====== PHÂN LOẠI TAB ====== */
function CategoriesTab({ categories, router }: { categories: any[]; router: any }) {
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [parentId, setParentId] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const roots = categories.filter((c: any) => !c.parentId);
  const children = (pid: string) => categories.filter((c: any) => c.parentId === pid);

  function onSubmit(fd: FormData) {
    setMsg(null);
    startTransition(async () => { const r = await createTransactionCategory(fd); if (r.ok) { setShowForm(false); setMsg("Đã tạo!"); router.refresh(); } else setMsg(r.error); });
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "var(--space-4)" }}>
        <button onClick={() => setShowForm(!showForm)} style={{ ...btn, height: 36, fontSize: "var(--text-xs)" }}>+ Thêm danh mục con</button>
      </div>

      {msg && <div style={{ padding: "var(--space-3)", background: msg.includes("Đã") ? "var(--color-success-bg)" : "var(--color-destructive-bg)", color: msg.includes("Đã") ? "var(--color-success)" : "var(--color-destructive)", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", marginBottom: "var(--space-4)" }}>{msg}</div>}

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
              <button type="submit" disabled={pending} style={{ ...btn, height: 36, fontSize: "var(--text-xs)" }}>{pending ? "..." : "Tạo"}</button>
              <button type="button" onClick={() => setShowForm(false)} style={{ ...btn, background: "var(--color-surface)", color: "var(--color-foreground)", border: "1px solid var(--color-border-strong)", height: 36, fontSize: "var(--text-xs)" }}>Hủy</button>
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

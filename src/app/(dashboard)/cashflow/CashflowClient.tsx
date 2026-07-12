"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordTransaction } from "@/app/actions/order-actions";
import { createAccount, updateAccount, deleteAccount, createCategory, updateCategory, deleteCategory } from "@/app/actions/cashflow-settings";

/* eslint-disable @typescript-eslint/no-explicit-any */

const S: React.CSSProperties = { width: "100%", height: 40, padding: "0 10px", border: "1px solid var(--color-border-strong)", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", fontFamily: "var(--font-sans)", background: "var(--color-surface)" };
const btn: React.CSSProperties = { height: 40, padding: "0 16px", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", fontWeight: 600, cursor: "pointer", border: "none", background: "var(--color-primary)", color: "white" };
const btnSm: React.CSSProperties = { height: 32, padding: "0 12px", borderRadius: "var(--radius-sm)", fontSize: "var(--text-xs)", fontWeight: 600, cursor: "pointer", border: "none" };

export default function CashflowClient({ accounts, transactions, categories }: { accounts: any[]; transactions: any[]; categories: any[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<"cashflow" | "settings">("cashflow");

  return (
    <div>
      <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, marginBottom: 0 }}>Tài chính</h1>
      <p style={{ fontSize: "var(--text-sm)", color: "var(--color-foreground-muted)", marginBottom: "var(--space-5)", marginTop: "var(--space-1)" }}>
        {accounts.length} tài khoản · {transactions.length} giao dịch · {categories.length} phân loại
      </p>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: "var(--space-5)", borderBottom: "2px solid var(--color-border)" }}>
        <TabBtn active={tab === "cashflow"} onClick={() => setTab("cashflow")} label="💵 Sổ quỹ" />
        <TabBtn active={tab === "settings"} onClick={() => setTab("settings")} label="⚙️ Cấu hình" />
      </div>

      {tab === "cashflow" && <CashflowTab accounts={accounts} transactions={transactions} categories={categories} router={router} />}
      {tab === "settings" && <SettingsTab accounts={accounts} categories={categories} router={router} />}
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
      {/* Header Container */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-4)", marginBottom: "var(--space-4)", flexWrap: "wrap" }}>
        
        {/* Summary */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)", flex: 1 }}>
          <div style={{ background: "var(--color-primary)10", border: "2px solid var(--color-primary)", borderRadius: "var(--radius-lg)", padding: "var(--space-3)", minWidth: 220 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "var(--space-1)" }}>
              <span style={{ fontWeight: 800, fontSize: "var(--text-sm)", color: "var(--color-primary)", textTransform: "uppercase" }}>TỔNG QUỸ</span>
              <span style={{ fontWeight: 800, color: "var(--color-primary)", fontSize: "var(--text-lg)" }}>{totalBal.toLocaleString("vi-VN")} đ</span>
            </div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--color-foreground-subtle)" }}>
              <span style={{ display: "inline-block", marginRight: "var(--space-3)" }}>Thu: <span style={{ color: "var(--color-success)", fontWeight: 600 }}>{totalInc.toLocaleString("vi-VN")}</span></span>
              <span style={{ display: "inline-block" }}>Chi: <span style={{ color: "var(--color-destructive)", fontWeight: 600 }}>{totalExp.toLocaleString("vi-VN")}</span></span>
            </div>
          </div>
          {summary.map((a: any) => (
            <div key={a.id} style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "var(--space-3)", minWidth: 200 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "var(--space-1)", gap: "var(--space-3)" }}>
                <span style={{ fontWeight: 700, fontSize: "var(--text-sm)" }}>{a.code}</span>
                <span style={{ fontWeight: 700, fontSize: "var(--text-base)", color: Number(a.balance) >= 0 ? "var(--color-success)" : "var(--color-destructive)" }}>{Number(a.balance).toLocaleString("vi-VN")} đ</span>
              </div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--color-foreground-subtle)" }}>
                <span style={{ display: "inline-block", marginRight: "var(--space-3)" }}>Thu: <span style={{ color: "var(--color-success)", fontWeight: 600 }}>{a.income.toLocaleString("vi-VN")}</span></span>
                <span style={{ display: "inline-block" }}>Chi: <span style={{ color: "var(--color-destructive)", fontWeight: 600 }}>{a.expense.toLocaleString("vi-VN")}</span></span>
              </div>
            </div>
          ))}
        </div>

        <button onClick={() => setShowForm(!showForm)} style={{...btn, whiteSpace: "nowrap"}}>+ Ghi nhận</button>
      </div>

      {showForm && (
        <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "var(--space-5)", marginBottom: "var(--space-4)" }}>
          {error && <div style={{ padding: "var(--space-2)", background: "var(--color-destructive-bg)", color: "var(--color-destructive)", borderRadius: "var(--radius-sm)", fontSize: "var(--text-xs)", marginBottom: "var(--space-3)" }}>{error}</div>}
          <form action={onSubmit} style={{ display: "grid", gap: "var(--space-3)", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
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
              <div>
                <label style={{ fontSize: "var(--text-xs)", fontWeight: 600, display: "block", marginBottom: 2 }}>Tài khoản *</label>
                <select name="accountId" style={S}>{accounts.map((a: any) => <option key={a.id} value={a.id}>{a.code} ({(Number(a.balance)||0).toLocaleString("vi-VN")} đ)</option>)}</select>
              </div>
            </div>
            
            <select name="type" style={S}><option value="INCOME">Thu vào</option><option value="EXPENSE">Chi ra</option></select>
            <div style={{ position: "relative" }}>
              <input name="amount" type="number" step="1" min="1" placeholder="Số tiền" style={{...S, paddingRight: 30}} required />
              <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: "var(--text-sm)", color: "var(--color-foreground-muted)", pointerEvents: "none" }}>đ</span>
            </div>
            <input name="description" placeholder="Diễn giải" style={{...S, gridColumn: "1 / -1"}} />
            
            <div style={{ display: "flex", gap: "var(--space-3)", gridColumn: "1 / -1" }}>
              <button type="submit" disabled={pending} style={btn}>{pending ? "..." : "Xác nhận Ghi nhận"}</button>
              <button type="button" onClick={() => setShowForm(false)} style={{ ...btn, background: "var(--color-surface)", color: "var(--color-foreground)", border: "1px solid var(--color-border-strong)" }}>Hủy</button>
            </div>
          </form>
        </div>
      )}

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

/* ====== CẤU HÌNH TAB ====== */
function SettingsTab({ accounts, categories, router }: { accounts: any[]; categories: any[]; router: any }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-5)" }}>
      {/* Khu vực 1: Quản lý Quỹ */}
      <AccountManager accounts={accounts} router={router} />
      
      {/* Khu vực 2: Quản lý Phân loại */}
      <CategoryManager categories={categories} router={router} />
    </div>
  );
}

/* ====== QUẢN LÝ QUỸ ====== */
function AccountManager({ accounts, router }: { accounts: any[]; router: any }) {
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  function onSubmit(fd: FormData) {
    setMsg(null);
    startTransition(async () => {
      let r: any;
      if (editId) {
        r = await updateAccount(editId, fd);
      } else {
        r = await createAccount(fd);
      }
      if (r.ok) {
        setShowForm(false);
        setEditId(null);
        setMsg(editId ? "Đã cập nhật!" : "Đã thêm!");
        router.refresh();
      } else {
        setMsg(r.error);
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Bạn có chắc muốn xóa Quỹ này?")) return;
    startTransition(async () => {
      const r = await deleteAccount(id);
      if (r.ok) {
        setMsg("Đã xóa!");
        router.refresh();
      } else {
        setMsg(r.error);
      }
    });
  }

  function startEdit(account: any) {
    setEditId(account.id);
    setShowForm(true);
  }

  const totalBal = accounts.reduce((s: number, a: any) => s + Number(a.balance), 0);

  return (
    <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "var(--space-5)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
        <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 700 }}>🏦 Quản lý Quỹ</h2>
        <button onClick={() => { setEditId(null); setShowForm(!showForm); }} style={{ ...btnSm, background: "var(--color-primary)", color: "white" }}>
          {showForm ? "Hủy" : "+ Thêm Quỹ"}
        </button>
      </div>

      {msg && (
        <div style={{ padding: "var(--space-2)", background: msg.includes("Đã") ? "var(--color-success-bg)" : "var(--color-destructive-bg)", color: msg.includes("Đã") ? "var(--color-success)" : "var(--color-destructive)", borderRadius: "var(--radius-sm)", fontSize: "var(--text-xs)", marginBottom: "var(--space-3)" }}>
          {msg}
        </div>
      )}

      {showForm && (
        <form action={onSubmit} style={{ display: "grid", gap: "var(--space-3)", marginBottom: "var(--space-4)", padding: "var(--space-4)", background: "var(--color-bg)", borderRadius: "var(--radius-md)" }}>
          <input name="name" placeholder="Tên Quỹ (VD: Tiền mặt, Ngân hàng)" style={S} required />
          <select name="type" style={S}>
            <option value="CASH">Tiền mặt</option>
            <option value="BANK">Ngân hàng</option>
          </select>
          <input name="initialBalance" type="number" step="1" placeholder="Số dư ban đầu" style={S} defaultValue={editId ? accounts.find((a: any) => a.id === editId)?.initialBalance || "0" : "0"} />
          <input name="description" placeholder="Mô tả (tùy chọn)" style={S} defaultValue={editId ? accounts.find((a: any) => a.id === editId)?.description || "" : ""} />
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <button type="submit" disabled={pending} style={{ ...btnSm, background: "var(--color-primary)", color: "white" }}>
              {pending ? "..." : editId ? "Lưu" : "Thêm"}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditId(null); }} style={{ ...btnSm, background: "var(--color-muted)", color: "var(--color-foreground)" }}>
              Hủy
            </button>
          </div>
        </form>
      )}

      <div style={{ fontSize: "var(--text-sm)", marginBottom: "var(--space-3)", color: "var(--color-foreground-muted)" }}>
        Tổng số dư: <strong>{totalBal.toLocaleString("vi-VN")} đ</strong>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        {accounts.length === 0 ? (
          <div style={{ padding: "var(--space-4)", textAlign: "center", color: "var(--color-foreground-muted)", fontSize: "var(--text-sm)" }}>Chưa có Quỹ nào</div>
        ) : (
          accounts.map((a: any) => (
            <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "var(--space-3)", background: "var(--color-bg)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>{a.name}</div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--color-foreground-muted)" }}>
                  {a.type === "CASH" ? "💵 Tiền mặt" : "🏦 Ngân hàng"} · {Number(a.balance).toLocaleString("vi-VN")} đ
                </div>
              </div>
              <div style={{ display: "flex", gap: "var(--space-2)" }}>
                <button onClick={() => startEdit(a)} style={{ ...btnSm, background: "var(--color-surface)", color: "var(--color-primary)", border: "1px solid var(--color-primary)" }}>Sửa</button>
                <button onClick={() => handleDelete(a.id)} style={{ ...btnSm, background: "var(--color-destructive-bg)", color: "var(--color-destructive)", border: "1px solid var(--color-destructive)" }}>Xóa</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ====== QUẢN LÝ PHÂN LOẠI ====== */
function CategoryManager({ categories, router }: { categories: any[]; router: any }) {
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [parentId, setParentId] = useState("");

  const roots = categories.filter((c: any) => !c.parentId);
  const children = (pid: string) => categories.filter((c: any) => c.parentId === pid);

  function onSubmit(fd: FormData) {
    setMsg(null);
    startTransition(async () => {
      let r: any;
      if (editId) {
        r = await updateCategory(editId, fd);
      } else {
        r = await createCategory(fd);
      }
      if (r.ok) {
        setShowForm(false);
        setEditId(null);
        setParentId("");
        setMsg(editId ? "Đã cập nhật!" : "Đã thêm!");
        router.refresh();
      } else {
        setMsg(r.error);
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Bạn có chắc muốn xóa Phân loại này?")) return;
    startTransition(async () => {
      const r = await deleteCategory(id);
      if (r.ok) {
        setMsg("Đã xóa!");
        router.refresh();
      } else {
        setMsg(r.error);
      }
    });
  }

  function startEdit(category: any) {
    setEditId(category.id);
    setParentId(category.parentId || "");
    setShowForm(true);
  }

  return (
    <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "var(--space-5)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
        <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 700 }}>🏷️ Quản lý Phân loại</h2>
        <button onClick={() => { setEditId(null); setParentId(""); setShowForm(!showForm); }} style={{ ...btnSm, background: "var(--color-primary)", color: "white" }}>
          {showForm ? "Hủy" : "+ Thêm Phân loại"}
        </button>
      </div>

      {msg && (
        <div style={{ padding: "var(--space-2)", background: msg.includes("Đã") ? "var(--color-success-bg)" : "var(--color-destructive-bg)", color: msg.includes("Đã") ? "var(--color-success)" : "var(--color-destructive)", borderRadius: "var(--radius-sm)", fontSize: "var(--text-xs)", marginBottom: "var(--space-3)" }}>
          {msg}
        </div>
      )}

      {showForm && (
        <form action={onSubmit} style={{ display: "grid", gap: "var(--space-3)", marginBottom: "var(--space-4)", padding: "var(--space-4)", background: "var(--color-bg)", borderRadius: "var(--radius-md)" }}>
          <input name="name" placeholder="Tên Phân loại" style={S} required defaultValue={editId ? categories.find((c: any) => c.id === editId)?.name || "" : ""} />
          <select name="parentId" style={S} value={parentId} onChange={e => setParentId(e.target.value)}>
            <option value="">-- Danh mục cha (tùy chọn) --</option>
            {roots.filter((r: any) => r.id !== editId).map((r: any) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          <select name="direction" style={S} defaultValue={editId ? categories.find((c: any) => c.id === editId)?.direction || "IN" : "IN"}>
            <option value="IN">📥 Thu vào</option>
            <option value="OUT">📤 Chi ra</option>
          </select>
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <button type="submit" disabled={pending} style={{ ...btnSm, background: "var(--color-primary)", color: "white" }}>
              {pending ? "..." : editId ? "Lưu" : "Thêm"}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditId(null); setParentId(""); }} style={{ ...btnSm, background: "var(--color-muted)", color: "var(--color-foreground)" }}>
              Hủy
            </button>
          </div>
        </form>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        {roots.length === 0 ? (
          <div style={{ padding: "var(--space-4)", textAlign: "center", color: "var(--color-foreground-muted)", fontSize: "var(--text-sm)" }}>Chưa có Phân loại nào</div>
        ) : (
          roots.map((root: any) => (
            <div key={root.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "var(--space-3)", background: "var(--color-primary)10", borderRadius: "var(--radius-md)", border: "1px solid var(--color-primary)", marginBottom: "var(--space-2)" }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: "var(--text-sm)" }}>📁 {root.name}</span>
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--color-foreground-muted)", marginLeft: "var(--space-2)" }}>
                    {root.direction === "IN" ? "📥 Thu" : "📤 Chi"}
                  </span>
                </div>
                <div style={{ display: "flex", gap: "var(--space-2)" }}>
                  <button onClick={() => startEdit(root)} style={{ ...btnSm, background: "var(--color-surface)", color: "var(--color-primary)", border: "1px solid var(--color-primary)" }}>Sửa</button>
                  <button onClick={() => handleDelete(root.id)} style={{ ...btnSm, background: "var(--color-destructive-bg)", color: "var(--color-destructive)", border: "1px solid var(--color-destructive)" }}>Xóa</button>
                </div>
              </div>
              {children(root.id).length > 0 && (
                <div style={{ marginLeft: "var(--space-5)", display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                  {children(root.id).map((child: any) => (
                    <div key={child.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "var(--space-2) var(--space-3)", background: "var(--color-bg)", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)" }}>
                      <span style={{ fontSize: "var(--text-sm)" }}>📄 {child.name}</span>
                      <div style={{ display: "flex", gap: "var(--space-2)" }}>
                        <button onClick={() => startEdit(child)} style={{ ...btnSm, background: "var(--color-surface)", color: "var(--color-primary)", border: "1px solid var(--color-primary)" }}>Sửa</button>
                        <button onClick={() => handleDelete(child.id)} style={{ ...btnSm, background: "var(--color-destructive-bg)", color: "var(--color-destructive)", border: "1px solid var(--color-destructive)" }}>Xóa</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

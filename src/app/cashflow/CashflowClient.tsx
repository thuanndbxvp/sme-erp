"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordTransaction } from "@/app/actions/order-actions";

/* eslint-disable @typescript-eslint/no-explicit-any */

const S: React.CSSProperties = { width: "100%", height: 40, padding: "0 10px", border: "1px solid var(--color-border-strong)", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", fontFamily: "var(--font-sans)", background: "var(--color-surface)" };

export default function CashflowClient({ accounts, transactions, categories }: { accounts: any[]; transactions: any[]; categories: any[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onSubmit(fd: FormData) {
    setError(null);
    startTransition(async () => {
      const r = await recordTransaction(fd);
      if (r.ok) { setShowForm(false); router.refresh(); }
      else setError(r.error);
    });
  }

  // Build category tree
  const roots = categories.filter((c: any) => !c.parentId);
  const children = (parentId: string) => categories.filter((c: any) => c.parentId === parentId);

  const summary = accounts.map((a: any) => {
    const txs = transactions.filter((t: any) => t.accountId === a.id);
    const income = txs.filter((t: any) => t.type === "INCOME").reduce((s: number, t: any) => s + Number(t.amount), 0);
    const expense = txs.filter((t: any) => t.type === "EXPENSE").reduce((s: number, t: any) => s + Number(t.amount), 0);
    return { ...a, income, expense, net: income - expense };
  });

  const totalBalance = summary.reduce((s: number, a: any) => s + Number(a.balance), 0);
  const totalIncome = summary.reduce((s: number, a: any) => s + a.income, 0);
  const totalExpense = summary.reduce((s: number, a: any) => s + a.expense, 0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-1)" }}>
        <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, margin: 0 }}>Sổ quỹ / Dòng tiền</h1>
        <button onClick={() => setShowForm(!showForm)} style={{ height: 40, padding: "0 16px", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", fontWeight: 600, cursor: "pointer", border: "none", background: "var(--color-primary)", color: "white" }}>+ Ghi nhận dòng tiền</button>
      </div>
      <p style={{ fontSize: "var(--text-sm)", color: "var(--color-foreground-muted)", marginBottom: "var(--space-5)" }}>{accounts.length} tài khoản · {transactions.length} giao dịch gần nhất</p>

      {/* Form */}
      {showForm && (
        <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "var(--space-5)", marginBottom: "var(--space-5)", maxWidth: 520 }}>
          {error && <div style={{ padding: "var(--space-2)", background: "var(--color-destructive-bg)", color: "var(--color-destructive)", borderRadius: "var(--radius-sm)", fontSize: "var(--text-xs)", marginBottom: "var(--space-3)" }}>{error}</div>}
          <form action={onSubmit} style={{ display: "grid", gap: "var(--space-3)" }}>
            {/* Category Tree Selector */}
            <div>
              <label style={{ fontSize: "var(--text-xs)", fontWeight: 600, display: "block", marginBottom: 2 }}>Phân loại dòng tiền *</label>
              <select name="categoryId" style={S} required>
                <option value="">-- Chọn phân loại --</option>
                {roots.map((root: any) => (
                  <optgroup key={root.id} label={root.name}>
                    <option value={root.id}>{root.name} (chung)</option>
                    {children(root.id).map((child: any) => (
                      <option key={child.id} value={child.id}>{"  " + child.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: "var(--text-xs)", fontWeight: 600, display: "block", marginBottom: 2 }}>Loại *</label>
              <select name="type" style={S}>
                <option value="INCOME">Thu tiền vào</option>
                <option value="EXPENSE">Chi tiền ra</option>
              </select>
            </div>
            <input name="amount" type="number" step="0.01" placeholder="Số tiền" style={S} required />
            <select name="accountId" style={S}>{accounts.map((a: any) => <option key={a.id} value={a.id}>{a.code} — {a.name} ({(Number(a.balance)||0).toLocaleString("vi-VN")} đ)</option>)}</select>
            <input name="description" placeholder="Diễn giải" style={S} />
            <div style={{ display: "flex", gap: "var(--space-3)" }}>
              <button type="submit" disabled={pending} style={{ height: 40, padding: "0 16px", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", fontWeight: 600, cursor: "pointer", border: "none", background: "var(--color-primary)", color: "white" }}>{pending ? "..." : "Ghi nhận"}</button>
              <button type="button" onClick={() => setShowForm(false)} style={{ height: 40, padding: "0 16px", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", fontWeight: 600, cursor: "pointer", border: "1px solid var(--color-border-strong)", background: "var(--color-surface)", color: "var(--color-foreground)" }}>Hủy</button>
            </div>
          </form>
        </div>
      )}

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "var(--space-4)", marginBottom: "var(--space-6)" }}>
        <div style={{ background: "var(--color-primary)15", border: "2px solid var(--color-primary)", borderRadius: "var(--radius-lg)", padding: "var(--space-4)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ fontWeight: 800, fontSize: "var(--text-base)", marginBottom: "var(--space-3)", color: "var(--color-primary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>TỔNG TẤT CẢ QUỸ TIỀN</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-2)", fontSize: "var(--text-sm)", marginBottom: "var(--space-3)" }}>
            <div><span style={{ color: "var(--color-foreground-subtle)", fontSize: "var(--text-xs)" }}>Tổng Thu</span><br /><span style={{ color: "var(--color-success)", fontWeight: 600 }}>{totalIncome.toLocaleString("vi-VN")}</span></div>
            <div><span style={{ color: "var(--color-foreground-subtle)", fontSize: "var(--text-xs)" }}>Tổng Chi</span><br /><span style={{ color: "var(--color-destructive)", fontWeight: 600 }}>{totalExpense.toLocaleString("vi-VN")}</span></div>
          </div>
          <div style={{ borderTop: "1px solid var(--color-primary)40", paddingTop: "var(--space-2)", marginTop: "auto" }}>
            <span style={{ color: "var(--color-primary)", fontSize: "var(--text-xs)", fontWeight: 600, textTransform: "uppercase" }}>Tổng Số Dư</span><br />
            <span style={{ fontWeight: 800, color: "var(--color-primary)", fontSize: "var(--text-2xl)" }}>{totalBalance.toLocaleString("vi-VN")} đ</span>
          </div>
        </div>
        {summary.map((a: any) => (
          <div key={a.id} style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "var(--space-4)", display: "flex", flexDirection: "column", justifyContent: "space-between", boxShadow: "var(--shadow-sm)" }}>
            <div style={{ fontWeight: 700, fontSize: "var(--text-base)", marginBottom: "var(--space-3)", color: "var(--color-foreground)" }}>{a.code} — {a.name}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-2)", fontSize: "var(--text-sm)", marginBottom: "var(--space-3)" }}>
              <div><span style={{ color: "var(--color-foreground-subtle)", fontSize: "var(--text-xs)" }}>Thu</span><br /><span style={{ color: "var(--color-success)", fontWeight: 600 }}>{a.income.toLocaleString("vi-VN")}</span></div>
              <div><span style={{ color: "var(--color-foreground-subtle)", fontSize: "var(--text-xs)" }}>Chi</span><br /><span style={{ color: "var(--color-destructive)", fontWeight: 600 }}>{a.expense.toLocaleString("vi-VN")}</span></div>
            </div>
            <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: "var(--space-2)", marginTop: "auto" }}>
              <span style={{ color: "var(--color-foreground-subtle)", fontSize: "var(--text-xs)", fontWeight: 600, textTransform: "uppercase" }}>Số dư hiện tại</span><br />
              <span style={{ fontWeight: 800, fontSize: "var(--text-xl)", color: "var(--color-foreground)" }}>{Number(a.balance).toLocaleString("vi-VN")} đ</span>
            </div>
          </div>
        ))}
      </div>

      {/* Transaction List */}
      <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
        <div style={{ maxHeight: "calc(100vh - 400px)", overflowY: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)", fontVariantNumeric: "tabular-nums" }}>
          <thead style={{ position: "sticky", top: 0, zIndex: 1, background: "var(--color-surface)" }}><tr style={{ borderBottom: "1px solid var(--color-border)", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-foreground-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Ngày</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Loại</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>TK</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>Số tiền</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Diễn giải</th>
          </tr></thead>
          <tbody>
            {transactions.length === 0 ? <tr><td colSpan={5} style={{ padding: "var(--space-10)", textAlign: "center", color: "var(--color-foreground-muted)" }}>Chưa có giao dịch</td></tr> :
              transactions.slice(0, 100).map((t: any, i: number) => (
                <tr key={t.id} style={{ borderBottom: i < Math.min(transactions.length, 100) - 1 ? "1px solid var(--color-muted)" : "none", background: i % 2 === 0 ? "var(--color-surface)" : "var(--color-surface-hover)" }}>
                  <td style={{ padding: "var(--space-3) var(--space-4)", whiteSpace: "nowrap" }}>{new Date(t.date).toLocaleDateString("vi-VN")}</td>
                  <td style={{ padding: "var(--space-3) var(--space-4)" }}><span style={{ color: t.type === "INCOME" ? "var(--color-success)" : "var(--color-destructive)", fontWeight: 600 }}>{t.type === "INCOME" ? "Thu" : "Chi"}</span></td>
                  <td style={{ padding: "var(--space-3) var(--space-4)" }}>{t.account.code}</td>
                  <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right", fontWeight: 600 }}>{Number(t.amount).toLocaleString("vi-VN")} đ</td>
                  <td style={{ padding: "var(--space-3) var(--space-4)", fontSize: "var(--text-xs)", color: "var(--color-foreground-muted)" }}>{t.description ?? ""}</td>
                </tr>
              ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

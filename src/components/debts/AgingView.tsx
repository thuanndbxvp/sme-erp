"use client";

import { useState } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface AgingRow {
  partyId: string;
  partyName: string;
  totalDue: number;
  current: number;
  d1_30: number;
  d31_60: number;
  d61_90: number;
  over90: number;
  invoiceCount: number;
}

interface Props {
  arData: AgingRow[];
  apData: AgingRow[];
}

export default function AgingView({ arData, apData }: Props) {
  const [tab, setTab] = useState<"AR" | "AP">("AR");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;
  const data = tab === "AR" ? arData : apData;
  const totalPages = Math.ceil(data.length / pageSize);
  const displayData = data.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalAll = data.reduce((s, r) => s + r.totalDue, 0);

  return (
    <div>
      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: "var(--space-5)", borderBottom: "2px solid var(--color-border)" }}>
        <AgingTab active={tab === "AR"} onClick={() => setTab("AR")} label="Phải thu" count={arData.length} color="var(--color-success)" />
        <AgingTab active={tab === "AP"} onClick={() => setTab("AP")} label="Phải trả" count={apData.length} color="var(--color-destructive)" />
      </div>

      {/* Summary bar */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr 1fr", gap: "var(--space-3)", marginBottom: "var(--space-5)", textAlign: "center" }}>
        <AgeBucket label="Tổng" amount={totalAll} color="var(--color-foreground)" bg="var(--color-surface)" border="var(--color-border)" />
        <AgeBucket label="Chưa đến hạn" amount={data.reduce((s, r) => s + r.current, 0)} color="var(--color-success)" bg="var(--color-success-bg)" border="var(--color-success)" />
        <AgeBucket label="1-30 ngày" amount={data.reduce((s, r) => s + r.d1_30, 0)} color="var(--color-warning)" bg="var(--color-warning-bg)" border="var(--color-warning)" />
        <AgeBucket label="31-60 ngày" amount={data.reduce((s, r) => s + r.d31_60, 0)} color="#EA580C" bg="#FFF7ED" border="#EA580C" />
        <AgeBucket label="61-90 ngày" amount={data.reduce((s, r) => s + r.d61_90, 0)} color="#DC2626" bg="#FEF2F2" border="#DC2626" />
        <AgeBucket label="> 90 ngày" amount={data.reduce((s, r) => s + r.over90, 0)} color="#991B1B" bg="#FEE2E2" border="#991B1B" />
      </div>

      {/* Table */}
      <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)", fontVariantNumeric: "tabular-nums" }}>
          <thead><tr style={{ borderBottom: "1px solid var(--color-border)", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-foreground-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center", width: 50 }}>STT</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>{tab === "AR" ? "Khách hàng" : "Nhà cung cấp"}</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>Tổng nợ</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>Chưa đến hạn</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>1-30 ngày</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>31-60 ngày</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>61-90 ngày</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>&gt; 90 ngày</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}>Số HĐ</th>
          </tr></thead>
          <tbody>
            {displayData.length === 0 ? (
              <tr><td colSpan={9} style={{ padding: "var(--space-10)", textAlign: "center", color: "var(--color-foreground-muted)" }}>Không có dữ liệu</td></tr>
            ) : displayData.map((r, i) => (
              <tr key={r.partyId} style={{ borderBottom: i < displayData.length - 1 ? "1px solid var(--color-muted)" : "none", background: i % 2 === 0 ? "var(--color-surface)" : "var(--color-surface-hover)" }}>
                <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}>{(currentPage - 1) * pageSize + i + 1}</td>
                <td style={{ padding: "var(--space-3) var(--space-4)", fontWeight: 500 }}>
                  <a href={tab === "AR" ? `/customers/${r.partyId}` : `/suppliers/${r.partyId}`} style={{ color: "var(--color-primary)", textDecoration: "none" }}>{r.partyName}</a>
                </td>
                <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right", fontWeight: 700 }}>{r.totalDue.toLocaleString("vi-VN")}</td>
                <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right", color: r.current > 0 ? "var(--color-success)" : "var(--color-foreground-muted)" }}>{r.current > 0 ? r.current.toLocaleString("vi-VN") : "—"}</td>
                <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right", color: r.d1_30 > 0 ? "var(--color-warning)" : "var(--color-foreground-muted)" }}>{r.d1_30 > 0 ? r.d1_30.toLocaleString("vi-VN") : "—"}</td>
                <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right", color: r.d31_60 > 0 ? "#EA580C" : "var(--color-foreground-muted)" }}>{r.d31_60 > 0 ? r.d31_60.toLocaleString("vi-VN") : "—"}</td>
                <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right", color: r.d61_90 > 0 ? "#DC2626" : "var(--color-foreground-muted)", fontWeight: r.d61_90 > 0 ? 600 : 400 }}>{r.d61_90 > 0 ? r.d61_90.toLocaleString("vi-VN") : "—"}</td>
                <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right", color: r.over90 > 0 ? "#991B1B" : "var(--color-foreground-muted)", fontWeight: r.over90 > 0 ? 700 : 400 }}>{r.over90 > 0 ? r.over90.toLocaleString("vi-VN") : "—"}</td>
                <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}>{r.invoiceCount}</td>
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

function AgingTab({ active, onClick, label, count, color }: { active: boolean; onClick: () => void; label: string; count: number; color: string }) {
  return (
    <button onClick={onClick} style={{
      padding: "var(--space-3) var(--space-5)", background: "none", border: "none",
      borderBottom: active ? `2px solid ${color}` : "2px solid transparent", marginBottom: -2,
      fontWeight: active ? 600 : 400, color: active ? color : "var(--color-foreground-muted)",
      fontSize: "var(--text-sm)", cursor: "pointer",
    }}>
      {label} ({count})
    </button>
  );
}

function AgeBucket({ label, amount, color, bg, border }: { label: string; amount: number; color: string; bg: string; border: string }) {
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: "var(--radius-md)", padding: "var(--space-3)" }}>
      <div style={{ fontSize: "var(--text-xs)", color: "var(--color-foreground-muted)", marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 700, color, fontSize: "var(--text-base)" }}>{amount.toLocaleString("vi-VN")}</div>
    </div>
  );
}

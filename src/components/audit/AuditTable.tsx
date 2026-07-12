"use client";

import { useState } from "react";

interface AuditLog { id: string; action: string; entityType: string; entityId: string; userId: string | null; createdAt: Date; }

interface Props { logs: AuditLog[]; }

export default function AuditTable({ logs }: Props) {
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;
  const totalPages = Math.ceil(logs.length / pageSize);
  const displayData = logs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <>
      <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)", fontVariantNumeric: "tabular-nums" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--color-border)", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-foreground-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center", width: 50 }}>STT</th>
              <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Hành động</th>
              <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Loại</th>
              <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>ID</th>
              <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Thời gian</th>
            </tr>
          </thead>
          <tbody>
            {displayData.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: "var(--space-10)", textAlign: "center", color: "var(--color-foreground-muted)" }}>Chưa có hoạt động nào</td>
              </tr>
            ) : (
              displayData.map((log, i) => (
                <tr key={log.id} style={{ borderBottom: i < displayData.length - 1 ? "1px solid var(--color-muted)" : "none", background: i % 2 === 0 ? "var(--color-surface)" : "var(--color-surface-hover)" }}>
                  <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}>{(currentPage - 1) * pageSize + i + 1}</td>
                  <td style={{ padding: "var(--space-3) var(--space-4)" }}>{log.action}</td>
                  <td style={{ padding: "var(--space-3) var(--space-4)" }}>{log.entityType}</td>
                  <td style={{ padding: "var(--space-3) var(--space-4)", fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={log.entityId}>{log.entityId}</td>
                  <td style={{ padding: "var(--space-3) var(--space-4)", whiteSpace: "nowrap" }}>{new Date(log.createdAt).toLocaleString("vi-VN")}</td>
                </tr>
              ))
            )}
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
    </>
  );
}

"use client";

import { useState } from "react";

interface AuditLog { id: string; action: string; entityType: string; entityId: string; userId: string | null; createdAt: Date; metadata?: any; }

interface Props { logs: AuditLog[]; }

const ACTION_MAP: Record<string, string> = {
  CREATE: "TẠO MỚI",
  UPDATE: "CẬP NHẬT",
  DELETE: "XÓA",
  CANCEL: "HỦY BỎ",
  APPROVE: "PHÊ DUYỆT"
};

const ENTITY_MAP: Record<string, string> = {
  TRANSACTION: "GIAO DỊCH",
  InventoryMovement: "KIỂM KÊ KHO",
  SalesOrder: "ĐƠN BÁN",
  PurchaseOrder: "ĐƠN MUA",
  Product: "SẢN PHẨM",
  WarehouseInventory: "TỒN KHO"
};

function formatMetadata(meta: any) {
  if (!meta || Object.keys(meta).length === 0) return "—";
  return Object.entries(meta).map(([k, v]) => {
    let key = k;
    if (k === "type") key = "Loại";
    if (k === "amount") key = "Số tiền";
    if (k === "accountId") key = "Mã Quỹ";
    if (k === "reason") key = "Lý do";
    if (k === "quantity") key = "Số lượng";
    if (k === "orderCode") key = "Mã ĐH";
    if (k === "adjustType") key = "Thao tác";
    if (k === "oldQty") key = "Tồn cũ";
    if (k === "newQty") key = "Tồn mới";
    return `${key}: ${v}`;
  }).join(" | ");
}

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
              <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left", width: 120 }}>Hành động</th>
              <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left", width: 150 }}>Loại dữ liệu</th>
              <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Chi tiết (Metadata)</th>
              <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right", width: 160 }}>Thời gian</th>
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
                  <td style={{ padding: "var(--space-3) var(--space-4)", fontWeight: 600, color: log.action === "DELETE" ? "var(--color-destructive)" : log.action === "CREATE" ? "var(--color-success)" : "var(--color-warning)" }}>{ACTION_MAP[log.action] || log.action}</td>
                  <td style={{ padding: "var(--space-3) var(--space-4)", fontWeight: 500 }}>{ENTITY_MAP[log.entityType] || log.entityType}</td>
                  <td style={{ padding: "var(--space-3) var(--space-4)", fontSize: "var(--text-xs)", color: "var(--color-foreground-muted)" }}>
                    <div style={{ marginBottom: 4, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--color-muted-foreground)" }}>ID: {log.entityId}</div>
                    <div>{formatMetadata(log.metadata)}</div>
                  </td>
                  <td style={{ padding: "var(--space-3) var(--space-4)", whiteSpace: "nowrap", textAlign: "right" }}>{new Date(log.createdAt).toLocaleString("vi-VN")}</td>
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

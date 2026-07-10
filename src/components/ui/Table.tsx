"use client";

import type { ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  /** Width hint (e.g. "120px", "1fr") */
  width?: string;
  align?: "left" | "right" | "center";
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  /** Render actions column (edit/delete buttons) */
  actions?: (row: T) => ReactNode;
  emptyMessage?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function Table<T extends Record<string, any>>({
  columns,
  rows,
  getRowKey,
  actions,
  emptyMessage = "Chưa có dữ liệu",
}: Props<T>) {
  const gridCols = columns.map((c) => c.width ?? "1fr").join(" ") + (actions ? " auto" : "");

  return (
    <div
      style={{
        background: "var(--color-surface)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--color-border)",
        overflow: "hidden",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: gridCols,
          padding: "var(--space-3) var(--space-4)",
          background: "var(--color-surface)",
          borderBottom: "1px solid var(--color-border)",
          fontSize: "var(--text-xs)",
          fontWeight: 600,
          color: "var(--color-foreground-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {columns.map((c) => (
          <div key={c.key} style={{ textAlign: c.align ?? "left" }}>
            {c.header}
          </div>
        ))}
        {actions && <div style={{ width: 120, textAlign: "right" }}>Thao tác</div>}
      </div>

      {/* Rows */}
      {rows.length === 0 ? (
        <div style={{ padding: "var(--space-10)", textAlign: "center", color: "var(--color-foreground-muted)", fontSize: "var(--text-sm)" }}>
          {emptyMessage}
        </div>
      ) : (
        rows.map((row, idx) => (
          <div
            key={getRowKey(row)}
            style={{
              display: "grid",
              gridTemplateColumns: gridCols,
              padding: "var(--space-3) var(--space-4)",
              borderBottom: idx < rows.length - 1 ? "1px solid var(--color-muted)" : "none",
              fontSize: "var(--text-sm)",
              alignItems: "center",
              background: idx % 2 === 0 ? "var(--color-surface)" : "var(--color-surface-hover)",
            }}
          >
            {columns.map((c) => (
              <div key={c.key} style={{ textAlign: c.align ?? "left", fontVariantNumeric: c.align === "right" ? "tabular-nums" : undefined }}>
                {c.render ? c.render(row) : String(row[c.key] ?? "")}
              </div>
            ))}
            {actions && (
              <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "flex-end" }}>
                {actions(row)}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

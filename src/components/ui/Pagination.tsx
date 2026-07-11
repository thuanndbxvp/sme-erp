"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface Props {
  currentPage: number;
  totalPages: number;
  pathname?: string;
}

export function Pagination({ currentPage, totalPages, pathname }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  if (totalPages <= 1) return null;

  function go(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (p <= 1) params.delete("page");
    else params.set("page", String(p));
    const qs = params.toString();
    router.push((pathname ?? "") + (qs ? `?${qs}` : ""));
  }

  const pages: (number | "...")[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "...") {
      pages.push("...");
    }
  }

  const btnBase: React.CSSProperties = {
    minWidth: 36, height: 36, padding: "0 8px", borderRadius: "var(--radius-md)",
    fontSize: "var(--text-sm)", fontWeight: 500, cursor: "pointer",
    border: "1px solid var(--color-border-strong)", background: "var(--color-surface)",
    color: "var(--color-foreground)", display: "inline-flex", alignItems: "center", justifyContent: "center",
  };

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "var(--space-2)", marginTop: "var(--space-5)", flexWrap: "wrap" }}>
      <button onClick={() => go(currentPage - 1)} disabled={currentPage <= 1} style={{ ...btnBase, opacity: currentPage <= 1 ? 0.4 : 1 }}>
        ‹ Trước
      </button>
      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`dots-${i}`} style={{ padding: "0 4px", color: "var(--color-foreground-muted)" }}>…</span>
        ) : (
          <button
            key={p}
            onClick={() => go(p as number)}
            style={{
              ...btnBase,
              background: p === currentPage ? "var(--color-primary)" : "var(--color-surface)",
              color: p === currentPage ? "white" : "var(--color-foreground)",
              borderColor: p === currentPage ? "var(--color-primary)" : "var(--color-border-strong)",
              fontWeight: p === currentPage ? 700 : 500,
            }}
          >
            {p}
          </button>
        )
      )}
      <button onClick={() => go(currentPage + 1)} disabled={currentPage >= totalPages} style={{ ...btnBase, opacity: currentPage >= totalPages ? 0.4 : 1 }}>
        Sau ›
      </button>
    </div>
  );
}

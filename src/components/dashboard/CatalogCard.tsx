"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export function CatalogCard({ href, icon, title, desc }: { href: string; icon: ReactNode; title: string; desc: string }) {
  return (
    <Link
      href={href}
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-5)",
        display: "flex",
        alignItems: "flex-start",
        gap: "var(--space-4)",
        textDecoration: "none",
        color: "var(--color-foreground)",
        transition: "box-shadow 150ms, border-color 150ms",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "var(--shadow-md)";
        e.currentTarget.style.borderColor = "var(--color-primary)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "var(--shadow-sm)";
        e.currentTarget.style.borderColor = "var(--color-border)";
      }}
    >
      <div style={{ width: 40, height: 40, borderRadius: "var(--radius-md)", background: "var(--color-primary)", color: "var(--color-on-primary)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontWeight: 600, fontSize: "var(--text-base)", marginBottom: "var(--space-1)" }}>{title}</div>
        <div style={{ fontSize: "var(--text-xs)", color: "var(--color-foreground-muted)", lineHeight: 1.625 }}>{desc}</div>
      </div>
    </Link>
  );
}

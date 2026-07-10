"use client";

import type { ReactNode, ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md";
  children: ReactNode;
}

interface VariantStyle { bg: string; color: string; border: string; hoverBg: string }

const styles: Record<Variant, VariantStyle> = {
  primary: { bg: "var(--color-primary)", color: "var(--color-on-primary)", border: "var(--color-primary)", hoverBg: "var(--color-primary-hover)" },
  secondary: { bg: "var(--color-surface)", color: "var(--color-foreground)", border: "var(--color-border-strong)", hoverBg: "var(--color-surface-hover)" },
  danger: { bg: "var(--color-destructive)", color: "white", border: "var(--color-destructive)", hoverBg: "var(--color-destructive-hover)" },
  ghost: { bg: "transparent", color: "var(--color-foreground-muted)", border: "transparent", hoverBg: "var(--color-surface-hover)" },
};

function variantStyle(v: Variant): VariantStyle { return styles[v]; }

export function Button({ variant = "primary", size = "md", children, style, disabled, ...props }: Props) {
  const s = variantStyle(variant);
  const height = size === "sm" ? 32 : "var(--touch-target)";
  const px = size === "sm" ? "var(--space-3)" : "var(--space-4)";
  const fontSize = size === "sm" ? "var(--text-xs)" : "var(--text-sm)";

  const btnStyle: React.CSSProperties = {
    height,
    padding: `0 ${px}`,
    background: disabled ? "var(--color-muted)" : s.bg,
    color: disabled ? "var(--color-foreground-subtle)" : s.color,
    border: `1px solid ${disabled ? "var(--color-muted)" : s.border}`,
    borderRadius: "var(--radius-md)",
    fontSize,
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: "var(--space-2)",
    transition: "background 150ms, box-shadow 150ms",
    whiteSpace: "nowrap",
    ...style,
  };

  return (
    <button
      style={btnStyle}
      disabled={disabled}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = s.hoverBg; }}
      onMouseLeave={(e) => { if (!disabled) e.currentTarget.style.background = s.bg; }}
      {...props}
    >
      {children}
    </button>
  );
}

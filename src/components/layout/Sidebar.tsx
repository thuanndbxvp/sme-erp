"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CATALOG_ENTITIES, CATALOG_REGISTRY } from "@/domain/catalog-registry";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside style={{ position: "fixed", top: 0, left: 0, bottom: 0, width: "var(--sidebar-width)", background: "var(--color-sidebar-bg)", color: "var(--color-sidebar-fg)", display: "flex", flexDirection: "column", overflowY: "auto", zIndex: 40 }}>
      {/* Brand */}
      <div style={{ padding: "var(--space-5) var(--space-4)", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
        <div style={{ width: 34, height: 34, borderRadius: "var(--radius-md)", background: "var(--color-primary)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: "var(--text-lg)" }}>E</div>
        <div>
          <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "white" }}>SME ERP</div>
          <div style={{ fontSize: "11px", color: "var(--color-foreground-subtle)" }}>Quản lý thương mại</div>
        </div>
      </div>

      <nav style={{ padding: "var(--space-3)", flex: 1 }}>
        <SectionLabel label="Kinh doanh" />
        <NavItem href="/orders" icon="📋" label="Đơn hàng" active={pathname.startsWith("/orders")} />
        <NavItem href="/cashflow" icon="💵" label="Sổ quỹ" active={pathname.startsWith("/cashflow")} />
        <NavItem href="/debts" icon="📊" label="Công nợ" active={pathname.startsWith("/debts")} />

        <div style={{ marginTop: "var(--space-4)" }}>
          <SectionLabel label="Danh mục" />
          {CATALOG_ENTITIES.map((e) => (
            <NavItem key={e} href={`/catalog/${e}`} icon={entityEmoji(e)} label={CATALOG_REGISTRY[e].labelPlural} active={pathname.startsWith(`/catalog/${e}`)} />
          ))}
          <NavItem href="/transaction-categories" icon="🏷️" label="Danh mục thu chi" active={pathname.startsWith("/transaction-categories")} />
        </div>

        <div style={{ marginTop: "var(--space-4)" }}>
          <SectionLabel label="Báo cáo" />
          <NavItem href="/reports" icon="📈" label="Báo cáo" active={pathname.startsWith("/reports")} />
        </div>

        <div style={{ marginTop: "var(--space-4)" }}>
          <SectionLabel label="Hệ thống" />
          <NavItem href="/audit" icon="📜" label="Nhật ký" active={pathname.startsWith("/audit")} />
          <NavItem href="/users" icon="👥" label="Người dùng" active={pathname.startsWith("/users")} />
          <NavItem href="/roles" icon="🔐" label="Phân quyền" active={pathname.startsWith("/roles")} />
          <NavItem href="/profile" icon="👤" label="Hồ sơ" active={pathname.startsWith("/profile")} />
        </div>
      </nav>

      <div style={{ padding: "var(--space-3) var(--space-4)", borderTop: "1px solid rgba(255,255,255,0.08)", fontSize: "11px", color: "var(--color-foreground-subtle)" }}>SME ERP v0.1</div>
    </aside>
  );
}

function SectionLabel({ label }: { label: string }) {
  return <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-foreground-subtle)", padding: "var(--space-2) var(--space-3) var(--space-1)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>;
}

function NavItem({ href, icon, label, active }: { href: string; icon: string; label: string; active: boolean }) {
  const [hover, setHover] = useState(false);
  return (
    <Link href={href} style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-2) var(--space-3)", borderRadius: "var(--radius-md)", color: active ? "white" : "var(--color-sidebar-fg)", fontSize: "var(--text-sm)", fontWeight: active ? 600 : 500, textDecoration: "none", minHeight: 36, marginBottom: 1, background: active ? "var(--color-sidebar-active-bg)" : hover ? "rgba(255,255,255,0.05)" : "transparent" }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <span style={{ fontSize: 15, width: 20, textAlign: "center" }}>{icon}</span>
      {label}
    </Link>
  );
}

function entityEmoji(e: string): string {
  const m: Record<string, string> = { product: "📦", customer: "👥", supplier: "🏭", warehouse: "🏗", account: "💰" };
  return m[e] ?? "•";
}

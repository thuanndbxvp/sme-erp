"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface MenuItem {
  icon: string;
  label: string;
  href: string;
  active: boolean;
  allowedRoles: string[];
}

interface MenuGroup {
  title: string;
  items: MenuItem[];
}

export function Sidebar({ userRole, userName }: { userRole: string; userName: string }) {
  const pathname = usePathname();

  const ALL_ROLES = ["ADMIN", "SALE", "ACCOUNTANT"];
  const ADMIN_ACC = ["ADMIN", "ACCOUNTANT"];
  const ADMIN_ONLY = ["ADMIN"];

  const MENU: MenuGroup[] = [
    {
      title: "Tổng quan",
      items: [
        { icon: "🏠", label: "Trung tâm Điều hành", href: "/", active: pathname === "/", allowedRoles: ALL_ROLES },
        { icon: "📈", label: "Báo cáo tổng quan", href: "/reports", active: pathname.startsWith("/reports"), allowedRoles: ADMIN_ONLY },
      ],
    },
    {
      title: "Kinh doanh & Đối tác",
      items: [
        { icon: "📋", label: "Đơn hàng", href: "/orders", active: pathname.startsWith("/orders"), allowedRoles: ALL_ROLES },
        { icon: "👥", label: "Khách hàng", href: "/catalog/customer", active: pathname.startsWith("/catalog/customer") || pathname.startsWith("/customers/"), allowedRoles: ALL_ROLES },
        { icon: "🏭", label: "Nhà cung cấp", href: "/catalog/supplier", active: pathname.startsWith("/catalog/supplier") || pathname.startsWith("/suppliers/"), allowedRoles: ALL_ROLES },
      ],
    },
    {
      title: "Sản phẩm & Tồn kho",
      items: [
        { icon: "📦", label: "Danh mục Sản phẩm", href: "/catalog/product", active: pathname.startsWith("/catalog/product") || pathname.startsWith("/products/"), allowedRoles: ALL_ROLES },
        { icon: "🏗️", label: "Quản lý kho", href: "/catalog/warehouse", active: pathname.startsWith("/catalog/warehouse"), allowedRoles: ALL_ROLES },
      ],
    },
    {
      title: "Tài chính & Nhân sự",
      items: [
        { icon: "💵", label: "Sổ quỹ / Dòng tiền", href: "/cashflow", active: pathname.startsWith("/cashflow"), allowedRoles: ADMIN_ACC },
        { icon: "📊", label: "Quản lý công nợ", href: "/debts", active: pathname.startsWith("/debts"), allowedRoles: ADMIN_ACC },
        { icon: "💼", label: "Hồ sơ & Lương", href: "/hr/employees", active: pathname.startsWith("/hr"), allowedRoles: ADMIN_ONLY },
      ],
    },
    {
      title: "Hệ thống",
      items: [
        { icon: "👤", label: "Người dùng", href: "/users", active: pathname.startsWith("/users"), allowedRoles: ADMIN_ONLY },
        { icon: "🔐", label: "Phân quyền", href: "/roles", active: pathname.startsWith("/roles"), allowedRoles: ADMIN_ONLY },
        { icon: "📜", label: "Nhật ký hệ thống", href: "/audit", active: pathname.startsWith("/audit"), allowedRoles: ADMIN_ONLY },
        { icon: "⚙️", label: "Hồ sơ cá nhân", href: "/profile", active: pathname.startsWith("/profile"), allowedRoles: ALL_ROLES },
      ],
    },
  ];

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
        {MENU.map((group) => {
          const visibleItems = group.items.filter((item) => item.allowedRoles.includes(userRole));
          if (visibleItems.length === 0) return null;
          return (
            <div key={group.title} style={{ marginTop: "var(--space-3)" }}>
              <SectionLabel label={group.title} />
              {visibleItems.map((item) => (
                <NavItem key={item.href} href={item.href} icon={item.icon} label={item.label} active={item.active} />
              ))}
            </div>
          );
        })}
      </nav>

      {/* User profile footer */}
      <div style={{ padding: "var(--space-3) var(--space-4)", borderTop: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.15)" }}>
        <p style={{ fontSize: "var(--text-sm)", fontWeight: 600, margin: 0, color: "white" }}>{userName}</p>
        <p style={{ fontSize: "11px", color: "var(--color-foreground-subtle)", margin: 0 }}>{userRole}</p>
      </div>
    </aside>
  );
}

function SectionLabel({ label }: { label: string }) {
  return <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-foreground-subtle)", padding: "var(--space-1) var(--space-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>;
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

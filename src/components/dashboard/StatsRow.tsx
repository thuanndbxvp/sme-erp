"use client";

import { useState } from "react";
import Link from "next/link";

interface Props {
  productCount: number;
  customerCount: number;
  supplierCount: number;
  warehouseCount: number;
  orderCount: number;
}

/** Client component — hiển thị stat cards với hover effect. */
export function StatsRow({ productCount, customerCount, supplierCount, warehouseCount, orderCount }: Props) {

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
        gap: "var(--space-4)",
        marginBottom: "var(--space-8)",
      }}
    >
      <StatCard label="Sản phẩm" value={String(productCount)} href="/catalog/product" />
      <StatCard label="Khách hàng" value={String(customerCount)} href="/catalog/customer" />
      <StatCard label="Nhà cung cấp" value={String(supplierCount)} href="/catalog/supplier" />
      <StatCard label="Kho" value={String(warehouseCount)} href="/catalog/warehouse" />
      <StatCard label="Đơn đã giao" value={String(orderCount)} href="#" />
    </div>
  );
}

function StatCard({ label, value, href }: { label: string; value: string; href: string }) {
  const [hover, setHover] = useState(false);
  return (
    <Link
      href={href}
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-4) var(--space-5)",
        textDecoration: "none",
        color: "var(--color-foreground)",
        display: "block",
        boxShadow: hover ? "var(--shadow-md)" : "none",
        transition: "box-shadow 150ms",
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div style={{ fontSize: "var(--text-xs)", color: "var(--color-foreground-muted)", fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: "var(--text-2xl)", fontWeight: 700, marginTop: "var(--space-1)", fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </Link>
  );
}

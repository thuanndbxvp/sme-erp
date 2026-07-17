"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Coins,
  AlertTriangle,
  Package,
  Users,
  Factory,
} from "lucide-react";
import * as Recharts from "recharts";
const {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} = Recharts;

/* eslint-disable @typescript-eslint/no-explicit-any */

type PlPeriod = "month" | "quarter" | "year";

const PL_TABS: { id: PlPeriod; label: string }[] = [
  { id: "month", label: "Tháng này" },
  { id: "quarter", label: "Quý này" },
  { id: "year", label: "Năm nay" },
];

interface PlBucket {
  label: string;
  revenue: number;
  expense: number;
  profit: number;
  sortKey: number;
}

export default function DashboardClient(props: {
  stats: { totalCash: number; totalAR: number; totalAP: number; netCashflow: number; monthlyProfit: number };
  userRole: string;
  isAdminOrAccountant: boolean;
  plMonth: PlBucket[];
  plQuarter: PlBucket[];
  plYear: PlBucket[];
  topAR: any[];
  topAP: any[];
  lowStock: any[];
}) {
  const { stats, userRole, isAdminOrAccountant, lowStock } = props;
  const [period, setPeriod] = useState<PlPeriod>("month");
  const plData = period === "month" ? props.plMonth : period === "quarter" ? props.plQuarter : props.plYear;

  const formatVND = (val: number) =>
    new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(Math.round(val));

  const formatCompact = (val: number) => {
    // Compact cho trục Y: "1.5M", "200K"
    if (Math.abs(val) >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(1)}B`;
    if (Math.abs(val) >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
    if (Math.abs(val) >= 1_000) return `${(val / 1_000).toFixed(0)}K`;
    return String(val);
  };

  const plSummary = useMemo(() => {
    return plData.reduce(
      (acc, b) => ({
        revenue: acc.revenue + b.revenue,
        expense: acc.expense + b.expense,
        profit: acc.profit + b.profit,
      }),
      { revenue: 0, expense: 0, profit: 0 },
    );
  }, [plData]);

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 8px" }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#0F172A", margin: 0, letterSpacing: "-0.02em" }}>
          Trung tâm Điều hành SME
        </h1>
        <p style={{ color: "#64748B", marginTop: 6, fontSize: 14 }}>
          Tổng quan tình hình kinh doanh và tài chính thời gian thực.
        </p>
      </div>

      {/* === KPI CARDS === */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 20,
          marginBottom: 28,
        }}
      >
        <KpiCard
          icon={<Wallet size={22} />}
          label="Tiền mặt (Cash)"
          value={formatVND(stats.totalCash)}
          tone="emerald"
          subLabel="Tổng các tài khoản quỹ"
        />
        <KpiCard
          icon={<TrendingUp size={22} />}
          label="Phải thu (AR)"
          value={formatVND(stats.totalAR)}
          tone="blue"
          subLabel="Khách hàng đang nợ"
        />
        <KpiCard
          icon={<TrendingDown size={22} />}
          label="Phải trả (AP)"
          value={formatVND(stats.totalAP)}
          tone="rose"
          subLabel="Nhà cung cấp đang chờ"
        />
        {userRole === "ADMIN" && (
          <KpiCard
            icon={<Coins size={22} />}
            label="Lãi Gộp Tháng Này"
            value={formatVND(stats.monthlyProfit)}
            tone="indigo"
            subLabel="Đơn DELIVERED tháng này"
          />
        )}
      </div>

      {/* === P&L CHART === */}
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: 12,
          padding: 24,
          marginBottom: 28,
          boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: 16,
            marginBottom: 20,
          }}
        >
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", margin: 0 }}>
              📊 Biểu đồ Lợi Nhuận (P&L)
            </h2>
            <p style={{ color: "#64748B", fontSize: 13, marginTop: 4 }}>
              So sánh <strong style={{ color: "#10B981" }}>Doanh thu</strong> và{" "}
              <strong style={{ color: "#EF4444" }}>Chi phí</strong> theo thời gian.
            </p>
          </div>
          <div style={{ display: "flex", gap: 6, background: "#F1F5F9", padding: 4, borderRadius: 8 }}>
            {PL_TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setPeriod(t.id)}
                style={{
                  padding: "8px 14px",
                  borderRadius: 6,
                  border: "none",
                  background: period === t.id ? "#FFFFFF" : "transparent",
                  color: period === t.id ? "#0F172A" : "#64748B",
                  fontWeight: period === t.id ? 700 : 500,
                  fontSize: 13,
                  cursor: "pointer",
                  boxShadow: period === t.id ? "0 1px 2px rgba(15,23,42,0.08)" : "none",
                  transition: "all 0.15s",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Summary row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 16,
            marginBottom: 20,
            padding: 16,
            background: "#F8FAFC",
            borderRadius: 8,
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
              Tổng Doanh Thu
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#10B981", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
              {formatVND(plSummary.revenue)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
              Tổng Chi Phí
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#EF4444", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
              {formatVND(plSummary.expense)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
              Lợi Nhuận Ròng
            </div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                marginTop: 4,
                fontVariantNumeric: "tabular-nums",
                color: plSummary.profit >= 0 ? "#10B981" : "#EF4444",
              }}
            >
              {formatVND(plSummary.profit)}
            </div>
          </div>
        </div>

        {/* Chart */}
        <div style={{ width: "100%", height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={plData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#64748B" }} />
              <YAxis tickFormatter={formatCompact} tick={{ fontSize: 12, fill: "#64748B" }} />
              <Tooltip
                formatter={(value) => formatVND(value as number)}
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid #E2E8F0",
                  fontSize: 13,
                  boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
                }}
              />
              <Legend wrapperStyle={{ fontSize: 13, paddingTop: 8 }} />
              <Bar dataKey="revenue" name="Doanh thu" radius={[6, 6, 0, 0]} maxBarSize={48}>
                {plData.map((entry, i) => (
                  <Cell key={`rev-${i}`} fill="#10B981" />
                ))}
              </Bar>
              <Bar dataKey="expense" name="Chi phí" radius={[6, 6, 0, 0]} maxBarSize={48}>
                {plData.map((entry, i) => (
                  <Cell key={`exp-${i}`} fill="#EF4444" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* === CASHFLOW BANNER === */}
      {isAdminOrAccountant && (
        <div
          style={{
            padding: "20px 24px",
            borderRadius: 12,
            marginBottom: 28,
            border: stats.netCashflow < 0 ? "1px solid #FECACA" : "1px solid #A7F3D0",
            background: stats.netCashflow < 0 ? "linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%)" : "linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)",
            boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: stats.netCashflow < 0 ? "#FEE2E2" : "#D1FAE5",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: stats.netCashflow < 0 ? "#DC2626" : "#059669",
                }}
              >
                <AlertTriangle size={22} />
              </div>
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 700, color: "#0F172A", margin: 0 }}>
                  Dòng tiền dự kiến (Net Cashflow)
                </h2>
                <p style={{ fontSize: 12, color: "#64748B", margin: "2px 0 0 0" }}>
                  Công thức sinh tồn = Tiền Cash + Phải Thu - Phải Trả
                </p>
              </div>
            </div>
            <div
              style={{
                fontSize: 32,
                fontWeight: 800,
                fontVariantNumeric: "tabular-nums",
                color: stats.netCashflow < 0 ? "#DC2626" : "#059669",
                letterSpacing: "-0.02em",
              }}
            >
              {formatVND(stats.netCashflow)}
            </div>
          </div>
        </div>
      )}

      {/* === 3-COLUMN GRID: TOP AR / AP / LOW STOCK === */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 20,
        }}
      >
        {isAdminOrAccountant && (
          <WidgetCard
            title="Top Phải Thu (AR)"
            icon={<Users size={16} />}
            accentColor="#2563EB"
            link={{ href: "/debts", label: "Xem tất cả" }}
            emptyText="Không có khoản nợ nào"
            rows={props.topAR.map((inv: any) => ({
              key: inv.id,
              primary: inv.customer?.name || "Khách lẻ",
              secondary: inv.invoiceNumber,
              value: formatVND(Number(inv.balanceDue.toString())),
              valueColor: "#2563EB",
              meta: `${Math.floor((Date.now() - new Date(inv.createdAt).getTime()) / (1000 * 60 * 60 * 24))} ngày tuổi`,
            }))}
          />
        )}

        {isAdminOrAccountant && (
          <WidgetCard
            title="Top Phải Trả (AP)"
            icon={<Factory size={16} />}
            accentColor="#E11D48"
            link={{ href: "/debts", label: "Xem tất cả" }}
            emptyText="Không có khoản nợ nào"
            rows={props.topAP.map((inv: any) => ({
              key: inv.id,
              primary: inv.supplier?.name || "Nhà CC",
              secondary: inv.invoiceNumber,
              value: formatVND(Number(inv.balanceDue.toString())),
              valueColor: "#E11D48",
              meta: `${Math.floor((Date.now() - new Date(inv.createdAt).getTime()) / (1000 * 60 * 60 * 24))} ngày tuổi`,
            }))}
          />
        )}

        <WidgetCard
          title="Cảnh báo Tồn kho"
          icon={<Package size={16} />}
          accentColor="#D97706"
          link={{ href: "/catalog/product", label: "Tới kho" }}
          emptyText="Kho hàng an toàn"
          rows={lowStock.map((inv: any) => ({
            key: inv.id,
            primary: inv.product.name,
            secondary: `Mã: ${inv.product.sku}`,
            value: `Còn ${inv.quantity} ${inv.product.unit}`,
            valueColor: inv.quantity === 0 ? "#DC2626" : "#D97706",
          }))}
        />
      </div>
    </div>
  );
}

/* ===== SUB-COMPONENTS ===== */

function KpiCard({
  icon,
  label,
  value,
  tone,
  subLabel,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "emerald" | "blue" | "rose" | "indigo";
  subLabel?: string;
}) {
  const toneMap = {
    emerald: { bg: "#D1FAE5", fg: "#059669", accent: "#10B981" },
    blue: { bg: "#DBEAFE", fg: "#2563EB", accent: "#3B82F6" },
    rose: { bg: "#FFE4E6", fg: "#E11D48", accent: "#F43F5E" },
    indigo: { bg: "#E0E7FF", fg: "#4F46E5", accent: "#6366F1" },
  }[tone];
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E2E8F0",
        borderRadius: 12,
        padding: 20,
        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: toneMap.accent,
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: toneMap.bg,
            color: toneMap.fg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {icon}
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {label}
        </div>
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: "#0F172A", letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
      {subLabel && <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 6 }}>{subLabel}</div>}
    </div>
  );
}

function WidgetCard({
  title,
  icon,
  accentColor,
  link,
  emptyText,
  rows,
}: {
  title: string;
  icon: React.ReactNode;
  accentColor: string;
  link?: { href: string; label: string };
  emptyText: string;
  rows: Array<{ key: string; primary: string; secondary?: string; value: string; valueColor?: string; meta?: string }>;
}) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E2E8F0",
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid #E2E8F0",
          background: "#F8FAFC",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: accentColor }}>{icon}</span>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", margin: 0 }}>{title}</h3>
        </div>
        {link && (
          <Link href={link.href} style={{ fontSize: 12, color: "#2563EB", fontWeight: 600, textDecoration: "none" }}>
            {link.label} →
          </Link>
        )}
      </div>
      {rows.length === 0 ? (
        <div style={{ padding: 32, textAlign: "center", color: "#94A3B8", fontSize: 13 }}>{emptyText}</div>
      ) : (
        <div style={{ flex: 1 }}>
          {rows.map((r, i) => (
            <div
              key={r.key}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 20px",
                borderBottom: i < rows.length - 1 ? "1px solid #F1F5F9" : "none",
                background: i % 2 === 0 ? "#FFFFFF" : "#FAFBFC",
                gap: 12,
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.primary}
                </div>
                {(r.secondary || r.meta) && (
                  <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>
                    {r.secondary}
                    {r.meta && r.secondary && " · "}
                    {r.meta}
                  </div>
                )}
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: r.valueColor || "#0F172A",
                  fontVariantNumeric: "tabular-nums",
                  whiteSpace: "nowrap",
                }}
              >
                {r.value}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
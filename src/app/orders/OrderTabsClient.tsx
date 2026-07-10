"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deliverOrder, cancelOrder } from "@/app/actions/order-actions";
import Link from "next/link";

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function OrderTabsClient({ salesOrders, purchaseOrders }: { salesOrders: any[]; purchaseOrders: any[] }) {
  const [tab, setTab] = useState<"SO" | "PO">("SO");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const orders = tab === "SO" ? salesOrders : purchaseOrders;
  const label = tab === "SO" ? "Đơn bán" : "Đơn mua";

  function doDeliver(id: string) {
    startTransition(async () => {
      const fd = new FormData(); fd.set("id", id);
      await deliverOrder(fd);
      router.refresh();
    });
  }
  function doCancel(id: string) {
    startTransition(async () => {
      const fd = new FormData(); fd.set("id", id); fd.set("type", tab);
      await cancelOrder(fd);
      router.refresh();
    });
  }

  const statusColor = (s: string) => {
    if (s === "DELIVERED" || s === "RECEIVED") return "var(--color-success)";
    if (s === "CANCELLED") return "var(--color-destructive)";
    return "var(--color-warning)";
  };
  return (
    <div>
      {/* Action bar */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-4)" }}>
        <Link href="/orders/new" style={{ height: 40, padding: "0 20px", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", fontWeight: 600, background: "var(--color-primary)", color: "white", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", textDecoration: "none" }}>+ Tạo đơn mới</Link>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: "var(--space-5)", borderBottom: "2px solid var(--color-border)" }}>
        {(["SO", "PO"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "var(--space-3) var(--space-5)",
              background: "none",
              border: "none",
              borderBottom: tab === t ? "2px solid var(--color-primary)" : "2px solid transparent",
              marginBottom: -2,
              fontWeight: tab === t ? 600 : 400,
              color: tab === t ? "var(--color-primary)" : "var(--color-foreground-muted)",
              fontSize: "var(--text-sm)",
              cursor: "pointer",
            }}
          >
            {t === "SO" ? "Đơn bán" : "Đơn mua"} ({t === "SO" ? salesOrders.length : purchaseOrders.length})
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)", fontVariantNumeric: "tabular-nums" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--color-border)", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-foreground-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Mã</th>
              <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>{tab === "SO" ? "Khách hàng" : "Nhà cung cấp"}</th>
              <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Sản phẩm</th>
              <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>Tổng tiền</th>
              <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}>Trạng thái</th>
              <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}>Thanh toán</th>
              <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>Ngày</th>
              <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center", width: 150 }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: "var(--space-10)", textAlign: "center", color: "var(--color-foreground-muted)" }}>Chưa có {label.toLowerCase()} nào</td></tr>
            ) : orders.map((o, i) => (
              <tr key={o.id} style={{ borderBottom: i < orders.length - 1 ? "1px solid var(--color-muted)" : "none", background: i % 2 === 0 ? "var(--color-surface)" : "var(--color-surface-hover)" }}>
                <td style={{ padding: "var(--space-3) var(--space-4)", fontWeight: 500 }}>{o.orderCode}</td>
                <td style={{ padding: "var(--space-3) var(--space-4)" }}>{tab === "SO" ? o.customer?.name ?? "—" : o.supplier?.name ?? "—"}</td>
                <td style={{ padding: "var(--space-3) var(--space-4)", fontSize: "var(--text-xs)", color: "var(--color-foreground-muted)" }}>
                  {o.items?.slice(0, 3).map((it: any) => `${it.productName} x${it.qty}`).join(", ") ?? "—"}
                  {(o.items?.length ?? 0) > 3 ? ` +${o.items.length - 3}` : ""}
                </td>
                <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right", fontWeight: 600 }}>{Number(o.totalAmount).toLocaleString("vi-VN")} đ</td>
                <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}>
                  <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: "var(--radius-sm)", fontSize: "var(--text-xs)", fontWeight: 600, background: statusColor(o.status) + "20", color: statusColor(o.status) }}>
                    {o.status}
                  </span>
                </td>
                <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center", fontSize: "var(--text-xs)" }}>{o.paymentStatus}</td>
                <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right", fontSize: "var(--text-xs)", whiteSpace: "nowrap" }}>
                  {o.saleDate ? new Date(o.saleDate).toLocaleDateString("vi-VN") : o.orderDate ? new Date(o.orderDate).toLocaleDateString("vi-VN") : "—"}
                </td>
                <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center", whiteSpace: "nowrap" }}>
                  {o.status === "PENDING" && tab === "SO" && (
                    <button onClick={() => doDeliver(o.id)} disabled={pending} style={{ fontSize: "var(--text-xs)", padding: "2px 8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-success)", background: "var(--color-success-bg)", color: "var(--color-success)", cursor: "pointer", marginRight: 4 }}>Giao hàng</button>
                  )}
                  {(o.status === "PENDING" || o.status === "ORDERED" || o.status === "DELIVERED" || o.status === "RECEIVED") && (
                    <button onClick={() => doCancel(o.id)} disabled={pending} style={{ fontSize: "var(--text-xs)", padding: "2px 8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-destructive)", background: "var(--color-destructive-bg)", color: "var(--color-destructive)", cursor: "pointer" }}>Hủy</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

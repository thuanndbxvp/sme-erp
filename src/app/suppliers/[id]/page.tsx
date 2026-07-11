import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export default async function SupplierDetailPage({ params }: Params) {
  const { id } = await params;
  const supplier = await prisma.supplier.findUnique({
    where: { id },
    include: {
      invoices: { where: { status: { not: "CANCELLED" } }, orderBy: { createdAt: "desc" }, include: { purchaseOrder: { select: { orderCode: true } } } },
      purchaseOrders: { orderBy: { createdAt: "desc" }, take: 50, include: { items: true } },
      _count: { select: { purchaseOrders: true } },
    },
  });
  if (!supplier) notFound();

  const totalAP = supplier.invoices.filter(i => i.type === "AP").reduce((s, i) => s + Number(i.balanceDue), 0);
  const totalPaid = supplier.invoices.filter(i => i.type === "AP").reduce((s, i) => s + Number(i.paidAmount), 0);
  const totalInvoiced = supplier.invoices.filter(i => i.type === "AP").reduce((s, i) => s + Number(i.totalAmount), 0);

  return (
    <div>
      <div style={{ marginBottom: "var(--space-6)" }}>
        <Link href="/catalog/supplier" style={{ fontSize: "var(--text-xs)", color: "var(--color-foreground-muted)" }}>← Danh sách nhà cung cấp</Link>
        <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, margin: "var(--space-2) 0 0" }}>{supplier.name}</h1>
        <div style={{ display: "flex", gap: "var(--space-4)", fontSize: "var(--text-sm)", color: "var(--color-foreground-muted)", marginTop: "var(--space-2)" }}>
          <span>📞 {supplier.phone || "—"}</span>
          <span>📋 {supplier._count.purchaseOrders} đơn mua</span>
        </div>
      </div>

      {/* AP Debt Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--space-4)", marginBottom: "var(--space-6)" }}>
        <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "var(--space-4)" }}>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--color-foreground-muted)" }}>Tổng hóa đơn</div>
          <div style={{ fontSize: "var(--text-xl)", fontWeight: 700, marginTop: "var(--space-1)" }}>{totalInvoiced.toLocaleString("vi-VN")} đ</div>
        </div>
        <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "var(--space-4)" }}>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--color-foreground-muted)" }}>Đã thanh toán</div>
          <div style={{ fontSize: "var(--text-xl)", fontWeight: 700, marginTop: "var(--space-1)", color: "var(--color-success)" }}>{totalPaid.toLocaleString("vi-VN")} đ</div>
        </div>
        <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "var(--space-4)" }}>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--color-foreground-muted)" }}>Còn nợ NCC (AP)</div>
          <div style={{ fontSize: "var(--text-xl)", fontWeight: 700, marginTop: "var(--space-1)", color: totalAP > 0 ? "var(--color-destructive)" : "var(--color-success)" }}>{totalAP.toLocaleString("vi-VN")} đ</div>
        </div>
      </div>

      {/* Invoices */}
      <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 600, marginBottom: "var(--space-3)" }}>Hóa đơn / Công nợ ({supplier.invoices.length})</h2>
      <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", overflow: "hidden", marginBottom: "var(--space-6)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)", fontVariantNumeric: "tabular-nums" }}>
          <thead><tr style={{ borderBottom: "1px solid var(--color-border)", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-foreground-muted)", textTransform: "uppercase" }}>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Hóa đơn</th><th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Đơn mua</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>Tổng</th><th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>Đã trả</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>Còn nợ</th><th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}>TT</th>
          </tr></thead>
          <tbody>
            {supplier.invoices.length === 0 ? <tr><td colSpan={6} style={{ padding: "var(--space-6)", textAlign: "center", color: "var(--color-foreground-muted)" }}>Chưa có hóa đơn</td></tr> :
              supplier.invoices.map((inv, i) => (
                <tr key={inv.id} style={{ borderBottom: i < supplier.invoices.length - 1 ? "1px solid var(--color-muted)" : "none", background: i % 2 === 0 ? "var(--color-surface)" : "var(--color-surface-hover)" }}>
                  <td style={{ padding: "var(--space-3) var(--space-4)", fontWeight: 500 }}>{inv.invoiceNumber}</td>
                  <td style={{ padding: "var(--space-3) var(--space-4)" }}>{inv.purchaseOrder?.orderCode || "—"}</td>
                  <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>{Number(inv.totalAmount).toLocaleString("vi-VN")}</td>
                  <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right", color: "var(--color-success)" }}>{Number(inv.paidAmount).toLocaleString("vi-VN")}</td>
                  <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right", fontWeight: 700, color: Number(inv.balanceDue) > 0 ? "var(--color-destructive)" : "var(--color-success)" }}>{Number(inv.balanceDue).toLocaleString("vi-VN")}</td>
                  <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}><span style={{ display: "inline-block", padding: "2px 8px", borderRadius: "var(--radius-sm)", fontSize: "var(--text-xs)", fontWeight: 600, background: inv.status === "PAID" ? "var(--color-success-bg)" : inv.status === "PARTIAL" ? "var(--color-warning-bg)" : "var(--color-muted)", color: inv.status === "PAID" ? "var(--color-success)" : inv.status === "PARTIAL" ? "var(--color-warning)" : "var(--color-foreground-muted)" }}>{inv.status}</span></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Purchase Orders */}
      <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 600, marginBottom: "var(--space-3)" }}>Đơn mua gần đây</h2>
      <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)" }}>
          <thead><tr style={{ borderBottom: "1px solid var(--color-border)", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-foreground-muted)", textTransform: "uppercase" }}>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Mã đơn</th><th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Sản phẩm</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>Tổng tiền</th><th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}>Trạng thái</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>Ngày</th>
          </tr></thead>
          <tbody>
            {supplier.purchaseOrders.length === 0 ? <tr><td colSpan={5} style={{ padding: "var(--space-6)", textAlign: "center", color: "var(--color-foreground-muted)" }}>Chưa có đơn mua</td></tr> :
              supplier.purchaseOrders.map((po, i) => (
                <tr key={po.id} style={{ borderBottom: i < supplier.purchaseOrders.length - 1 ? "1px solid var(--color-muted)" : "none", background: i % 2 === 0 ? "var(--color-surface)" : "var(--color-surface-hover)" }}>
                  <td style={{ padding: "var(--space-3) var(--space-4)", fontWeight: 500 }}>{po.orderCode}</td>
                  <td style={{ padding: "var(--space-3) var(--space-4)", fontSize: "var(--text-xs)", color: "var(--color-foreground-muted)" }}>{po.items.slice(0, 2).map(it => `${it.productName} x${it.qty}`).join(", ") || "—"}</td>
                  <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right", fontWeight: 600 }}>{Number(po.totalAmount).toLocaleString("vi-VN")} đ</td>
                  <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}><span style={{ display: "inline-block", padding: "2px 8px", borderRadius: "var(--radius-sm)", fontSize: "var(--text-xs)", fontWeight: 600, background: po.status === "RECEIVED" ? "var(--color-success-bg)" : po.status === "CANCELLED" ? "var(--color-destructive-bg)" : "var(--color-warning-bg)", color: po.status === "RECEIVED" ? "var(--color-success)" : po.status === "CANCELLED" ? "var(--color-destructive)" : "var(--color-warning)" }}>{po.status}</span></td>
                  <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right", fontSize: "var(--text-xs)", whiteSpace: "nowrap" }}>{po.orderDate ? new Date(po.orderDate).toLocaleDateString("vi-VN") : "—"}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

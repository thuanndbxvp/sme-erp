import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export default async function CustomerDetailPage({ params }: Params) {
  const { id } = await params;
  const customer = await prisma.customer.findUnique({ where: { id }, include: { invoices: { where: { status: { not: "CANCELLED" } }, orderBy: { createdAt: "desc" }, include: { salesOrder: { select: { orderCode: true } } } }, salesOrders: { orderBy: { createdAt: "desc" }, take: 50, include: { items: true } }, _count: { select: { salesOrders: true } } } });
  if (!customer) notFound();

  const totalAR = customer.invoices.filter(i => i.type === "AR").reduce((s, i) => s + Number(i.balanceDue), 0);
  const totalPaid = customer.invoices.filter(i => i.type === "AR").reduce((s, i) => s + Number(i.paidAmount), 0);
  const totalInvoiced = customer.invoices.filter(i => i.type === "AR").reduce((s, i) => s + Number(i.totalAmount), 0);

  return (
    <div>
      <div style={{ marginBottom: "var(--space-6)" }}>
        <Link href="/catalog/customer" style={{ fontSize: "var(--text-xs)", color: "var(--color-foreground-muted)" }}>← Danh sách khách hàng</Link>
        <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, margin: "var(--space-2) 0 0" }}>{customer.name}</h1>
        <div style={{ display: "flex", gap: "var(--space-4)", fontSize: "var(--text-sm)", color: "var(--color-foreground-muted)", marginTop: "var(--space-2)" }}>
          <span>📞 {customer.phone || "—"}</span>
          <span>✉ {customer.email || "—"}</span>
          <span>📋 {customer._count.salesOrders} đơn hàng</span>
        </div>
      </div>

      {/* Debt Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--space-4)", marginBottom: "var(--space-6)" }}>
        <DebtCard label="Tổng hóa đơn" value={totalInvoiced.toLocaleString("vi-VN") + " đ"} color="var(--color-foreground)" />
        <DebtCard label="Đã thanh toán" value={totalPaid.toLocaleString("vi-VN") + " đ"} color="var(--color-success)" />
        <DebtCard label="Còn nợ (AR)" value={totalAR.toLocaleString("vi-VN") + " đ"} color={totalAR > 0 ? "var(--color-destructive)" : "var(--color-success)"} />
      </div>

      {/* Invoices */}
      <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 600, marginBottom: "var(--space-3)" }}>Hóa đơn / Công nợ ({customer.invoices.length})</h2>
      <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", overflow: "hidden", marginBottom: "var(--space-6)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)", fontVariantNumeric: "tabular-nums" }}>
          <thead><tr style={{ borderBottom: "1px solid var(--color-border)", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-foreground-muted)", textTransform: "uppercase" }}>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Hóa đơn</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Đơn hàng</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>Tổng</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>Đã trả</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>Còn nợ</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}>TT</th>
          </tr></thead>
          <tbody>
            {customer.invoices.length === 0 ? <tr><td colSpan={6} style={{ padding: "var(--space-6)", textAlign: "center", color: "var(--color-foreground-muted)" }}>Chưa có hóa đơn</td></tr> :
              customer.invoices.map((inv, i) => (
                <tr key={inv.id} style={{ borderBottom: i < customer.invoices.length - 1 ? "1px solid var(--color-muted)" : "none", background: i % 2 === 0 ? "var(--color-surface)" : "var(--color-surface-hover)" }}>
                  <td style={{ padding: "var(--space-3) var(--space-4)", fontWeight: 500 }}>{inv.invoiceNumber}</td>
                  <td style={{ padding: "var(--space-3) var(--space-4)" }}>{inv.salesOrder?.orderCode || "—"}</td>
                  <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>{Number(inv.totalAmount).toLocaleString("vi-VN")}</td>
                  <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right", color: "var(--color-success)" }}>{Number(inv.paidAmount).toLocaleString("vi-VN")}</td>
                  <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right", fontWeight: 700, color: Number(inv.balanceDue) > 0 ? "var(--color-destructive)" : "var(--color-success)" }}>{Number(inv.balanceDue).toLocaleString("vi-VN")}</td>
                  <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}>
                    <StatusBadge status={inv.status} />
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Orders */}
      <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 600, marginBottom: "var(--space-3)" }}>Đơn hàng gần đây</h2>
      <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)" }}>
          <thead><tr style={{ borderBottom: "1px solid var(--color-border)", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-foreground-muted)", textTransform: "uppercase" }}>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Mã đơn</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Sản phẩm</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>Tổng tiền</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}>Trạng thái</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>Ngày</th>
          </tr></thead>
          <tbody>
            {customer.salesOrders.length === 0 ? <tr><td colSpan={5} style={{ padding: "var(--space-6)", textAlign: "center", color: "var(--color-foreground-muted)" }}>Chưa có đơn hàng</td></tr> :
              customer.salesOrders.map((so, i) => (
                <tr key={so.id} style={{ borderBottom: i < customer.salesOrders.length - 1 ? "1px solid var(--color-muted)" : "none", background: i % 2 === 0 ? "var(--color-surface)" : "var(--color-surface-hover)" }}>
                  <td style={{ padding: "var(--space-3) var(--space-4)", fontWeight: 500 }}>{so.orderCode}</td>
                  <td style={{ padding: "var(--space-3) var(--space-4)", fontSize: "var(--text-xs)", color: "var(--color-foreground-muted)" }}>{so.items.slice(0, 2).map(it => `${it.productName} x${it.qty}`).join(", ") || "—"}</td>
                  <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right", fontWeight: 600 }}>{Number(so.totalAmount).toLocaleString("vi-VN")} đ</td>
                  <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}><StatusBadge status={so.status} /></td>
                  <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right", fontSize: "var(--text-xs)", whiteSpace: "nowrap" }}>{so.saleDate ? new Date(so.saleDate).toLocaleDateString("vi-VN") : "—"}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DebtCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "var(--space-4)" }}>
      <div style={{ fontSize: "var(--text-xs)", color: "var(--color-foreground-muted)", fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: "var(--text-xl)", fontWeight: 700, marginTop: "var(--space-1)", color }}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color = status === "DELIVERED" || status === "PAID" ? "var(--color-success)" : status === "CANCELLED" ? "var(--color-destructive)" : "var(--color-warning)";
  return <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: "var(--radius-sm)", fontSize: "var(--text-xs)", fontWeight: 600, background: color + "20", color }}>{status}</span>;
}

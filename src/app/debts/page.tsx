import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DebtsPage() {
  const [arInvoices, apInvoices] = await Promise.all([
    prisma.invoice.findMany({ where: { type: "AR", status: { not: "CANCELLED" }, balanceDue: { gt: "0" } }, include: { customer: { select: { name: true } }, salesOrder: { select: { orderCode: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.invoice.findMany({ where: { type: "AP", status: { not: "CANCELLED" }, balanceDue: { gt: "0" } }, include: { supplier: { select: { name: true } }, purchaseOrder: { select: { orderCode: true } } }, orderBy: { createdAt: "desc" } }),
  ]);

  const totalAR = arInvoices.reduce((s, i) => s + Number(i.balanceDue), 0);
  const totalAP = apInvoices.reduce((s, i) => s + Number(i.balanceDue), 0);

  return (
    <div>
      <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, marginBottom: "var(--space-1)" }}>Công nợ</h1>
      <p style={{ fontSize: "var(--text-sm)", color: "var(--color-foreground-muted)", marginBottom: "var(--space-6)" }}>
        Phải thu: {totalAR.toLocaleString("vi-VN")} đ · Phải trả: {totalAP.toLocaleString("vi-VN")} đ
      </p>

      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)", marginBottom: "var(--space-6)" }}>
        <div style={{ background: "var(--color-success-bg)", border: "1px solid var(--color-success)", borderRadius: "var(--radius-lg)", padding: "var(--space-5)" }}>
          <div style={{ fontWeight: 600, color: "var(--color-success)" }}>Phải thu khách hàng</div>
          <div style={{ fontSize: "var(--text-2xl)", fontWeight: 700, marginTop: "var(--space-2)" }}>{totalAR.toLocaleString("vi-VN")} đ</div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--color-foreground-muted)", marginTop: "var(--space-1)" }}>{arInvoices.length} hóa đơn chưa thu hết</div>
        </div>
        <div style={{ background: "var(--color-warning-bg)", border: "1px solid var(--color-warning)", borderRadius: "var(--radius-lg)", padding: "var(--space-5)" }}>
          <div style={{ fontWeight: 600, color: "var(--color-warning)" }}>Phải trả nhà cung cấp</div>
          <div style={{ fontSize: "var(--text-2xl)", fontWeight: 700, marginTop: "var(--space-2)" }}>{totalAP.toLocaleString("vi-VN")} đ</div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--color-foreground-muted)", marginTop: "var(--space-1)" }}>{apInvoices.length} hóa đơn chưa trả hết</div>
        </div>
      </div>

      {/* AR Table */}
      <Section title={`Phải thu (${arInvoices.length})`}>
        <DebtTable rows={arInvoices.map(i => ({ invoice: i.invoiceNumber, party: i.customer?.name ?? "", total: Number(i.totalAmount), paid: Number(i.paidAmount), due: Number(i.balanceDue), status: i.status, order: i.salesOrder?.orderCode ?? "" }))} />
      </Section>

      <div style={{ marginTop: "var(--space-8)" }}>
        <Section title={`Phải trả (${apInvoices.length})`}>
          <DebtTable rows={apInvoices.map(i => ({ invoice: i.invoiceNumber, party: i.supplier?.name ?? "", total: Number(i.totalAmount), paid: Number(i.paidAmount), due: Number(i.balanceDue), status: i.status, order: i.purchaseOrder?.orderCode ?? "" }))} />
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 600, marginBottom: "var(--space-3)" }}>{title}</h2>
      {children}
    </div>
  );
}

function DebtTable({ rows }: { rows: Array<{ invoice: string; party: string; total: number; paid: number; due: number; status: string; order: string }> }) {
  return (
    <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)", fontVariantNumeric: "tabular-nums" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--color-border)", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-foreground-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Hóa đơn</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Đối tượng</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>Tổng</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>Đã trả</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>Còn nợ</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}>TT</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={6} style={{ padding: "var(--space-10)", textAlign: "center", color: "var(--color-foreground-muted)" }}>Không có khoản nào</td></tr>
          ) : rows.map((r, i) => (
            <tr key={r.invoice + i} style={{ borderBottom: i < rows.length - 1 ? "1px solid var(--color-muted)" : "none", background: i % 2 === 0 ? "var(--color-surface)" : "var(--color-surface-hover)" }}>
              <td style={{ padding: "var(--space-3) var(--space-4)", fontWeight: 500 }}>{r.invoice}</td>
              <td style={{ padding: "var(--space-3) var(--space-4)" }}>{r.party}</td>
              <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>{r.total.toLocaleString("vi-VN")}</td>
              <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right", color: "var(--color-success)" }}>{r.paid.toLocaleString("vi-VN")}</td>
              <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right", fontWeight: 700, color: r.due > 0 ? "var(--color-destructive)" : "var(--color-success)" }}>{r.due.toLocaleString("vi-VN")}</td>
              <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}>
                <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: "var(--radius-sm)", fontSize: "var(--text-xs)", fontWeight: 600, background: r.status === "PAID" ? "var(--color-success-bg)" : r.status === "PARTIAL" ? "var(--color-warning-bg)" : "var(--color-muted)", color: r.status === "PAID" ? "var(--color-success)" : r.status === "PARTIAL" ? "var(--color-warning)" : "var(--color-foreground-muted)" }}>
                  {r.status === "OPEN" ? "Chưa TT" : r.status === "PARTIAL" ? "1 phần" : r.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

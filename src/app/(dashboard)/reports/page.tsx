import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  // P&L
  const items = await prisma.salesOrderItem.findMany({
    where: { salesOrder: { status: "DELIVERED" } },
    select: { sellTotal: true, baseCost: true, qty: true },
  });
  let revenue = 0, cogs = 0;
  for (const it of items) { revenue += Number(it.sellTotal); cogs += Number(it.baseCost) * it.qty; }

  const expenses = await prisma.transaction.aggregate({ where: { type: "EXPENSE" }, _sum: { amount: true } });
  const totalExpense = Number(expenses._sum.amount ?? 0);
  const orderCount = await prisma.salesOrder.count({ where: { status: "DELIVERED" } });

  // AR/AP
  const ar = await prisma.invoice.aggregate({ where: { type: "AR", status: { not: "CANCELLED" } }, _sum: { balanceDue: true, totalAmount: true } });
  const ap = await prisma.invoice.aggregate({ where: { type: "AP", status: { not: "CANCELLED" } }, _sum: { balanceDue: true, totalAmount: true } });

  // Product sales
  const topProducts = await prisma.$queryRawUnsafe<Array<{ name: string; qty: number; revenue: number }>>(
    `SELECT p.name, SUM(i.qty)::int as qty, SUM(i."sellTotal")::decimal as revenue FROM "SalesOrderItem" i JOIN "Product" p ON p.id = i."productId" JOIN "SalesOrder" so ON so.id = i."salesOrderId" WHERE so.status = 'DELIVERED' GROUP BY p.name ORDER BY revenue DESC LIMIT 10`
  );

  return (
    <div>
      <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, marginBottom: "var(--space-6)" }}>Báo cáo</h1>

      {/* P&L Cards */}
      <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 600, marginBottom: "var(--space-3)" }}>Lỗ lãi (P&L)</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "var(--space-4)", marginBottom: "var(--space-6)" }}>
        <StatCard label="Doanh thu" value={revenue.toLocaleString("vi-VN") + " đ"} color="var(--color-success)" />
        <StatCard label="Giá vốn" value={cogs.toLocaleString("vi-VN") + " đ"} color="var(--color-destructive)" />
        <StatCard label="Lãi gộp" value={(revenue - cogs).toLocaleString("vi-VN") + " đ"} color="var(--color-primary)" />
        <StatCard label="Chi phí" value={totalExpense.toLocaleString("vi-VN") + " đ"} color="var(--color-warning)" />
        <StatCard label="Lãi ròng" value={(revenue - cogs - totalExpense).toLocaleString("vi-VN") + " đ"} color={revenue - cogs - totalExpense >= 0 ? "var(--color-success)" : "var(--color-destructive)"} />
        <StatCard label="Đơn đã giao" value={String(orderCount)} color="var(--color-foreground)" />
      </div>

      {/* AR/AP */}
      <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 600, marginBottom: "var(--space-3)" }}>Công nợ</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)", marginBottom: "var(--space-6)" }}>
        <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "var(--space-5)" }}>
          <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", marginBottom: "var(--space-2)" }}>Phải thu (AR)</div>
          <div style={{ fontSize: "var(--text-lg)" }}>Tổng: <strong>{Number(ar._sum.totalAmount ?? 0).toLocaleString("vi-VN")} đ</strong></div>
          <div style={{ color: "var(--color-destructive)", fontWeight: 600 }}>Còn: {Number(ar._sum.balanceDue ?? 0).toLocaleString("vi-VN")} đ</div>
        </div>
        <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "var(--space-5)" }}>
          <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", marginBottom: "var(--space-2)" }}>Phải trả (AP)</div>
          <div style={{ fontSize: "var(--text-lg)" }}>Tổng: <strong>{Number(ap._sum.totalAmount ?? 0).toLocaleString("vi-VN")} đ</strong></div>
          <div style={{ color: "var(--color-destructive)", fontWeight: 600 }}>Còn: {Number(ap._sum.balanceDue ?? 0).toLocaleString("vi-VN")} đ</div>
        </div>
      </div>

      {/* Top Products */}
      <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 600, marginBottom: "var(--space-3)" }}>Top sản phẩm bán chạy</h2>
      <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)", fontVariantNumeric: "tabular-nums" }}>
          <thead><tr style={{ borderBottom: "1px solid var(--color-border)", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-foreground-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center", width: 50 }}>STT</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Sản phẩm</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>SL bán</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>Doanh thu</th>
          </tr></thead>
          <tbody>
            {topProducts.length === 0 ? <tr><td colSpan={4} style={{ padding: "var(--space-6)", textAlign: "center", color: "var(--color-foreground-muted)" }}>Chưa có dữ liệu</td></tr> :
              topProducts.map((p, i) => (
                <tr key={p.name} style={{ borderBottom: i < topProducts.length - 1 ? "1px solid var(--color-muted)" : "none", background: i % 2 === 0 ? "var(--color-surface)" : "var(--color-surface-hover)" }}>
                  <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}>{i + 1}</td>
                  <td style={{ padding: "var(--space-3) var(--space-4)", fontWeight: 500 }}>{p.name}</td>
                  <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>{p.qty}</td>
                  <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right", fontWeight: 600 }}>{Number(p.revenue).toLocaleString("vi-VN")} đ</td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "var(--space-4)" }}>
      <div style={{ fontSize: "var(--text-xs)", color: "var(--color-foreground-muted)", fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: "var(--text-base)", fontWeight: 700, marginTop: "var(--space-1)", color }}>{value}</div>
    </div>
  );
}

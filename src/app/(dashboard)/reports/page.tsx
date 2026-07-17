import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { requirePagePermission } from "@/lib/authorize";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const session = await auth();
  await requirePagePermission(session?.user?.id, "report.view");
  const liveDate = new Date("2026-07-10T00:00:00Z");

  // P&L
  const items = await prisma.salesOrderItem.findMany({
    where: { salesOrder: { status: "DELIVERED", createdAt: { gte: liveDate } } },
    select: { sellTotal: true, baseCost: true, qty: true },
  });
  let revenue = 0, cogs = 0;
  for (const it of items) { revenue += Number(it.sellTotal); cogs += Number(it.baseCost) * it.qty; }

  const expenses = await prisma.transaction.aggregate({ where: { type: "EXPENSE", date: { gte: liveDate } }, _sum: { amount: true } });
  const totalExpense = Number(expenses._sum.amount ?? 0);
  const orderCount = await prisma.salesOrder.count({ where: { status: "DELIVERED", createdAt: { gte: liveDate } } });

  // AR/AP
  const ar = await prisma.invoice.aggregate({ where: { type: "AR", status: { not: "CANCELLED" } }, _sum: { balanceDue: true, totalAmount: true } });
  const ap = await prisma.invoice.aggregate({ where: { type: "AP", status: { not: "CANCELLED" } }, _sum: { balanceDue: true, totalAmount: true } });

  // Product sales
  const topProducts = await prisma.$queryRawUnsafe<Array<{ name: string; qty: number; revenue: number }>>(
    `SELECT p.name, SUM(i.qty)::int as qty, SUM(i."sellTotal")::decimal as revenue FROM "SalesOrderItem" i JOIN "Product" p ON p.id = i."productId" JOIN "SalesOrder" so ON so.id = i."salesOrderId" WHERE so.status = 'DELIVERED' AND so."createdAt" >= '2026-07-10' GROUP BY p.name ORDER BY revenue DESC LIMIT 10`
  );

  return (
    <div style={{ paddingBottom: "var(--space-10)" }}>
      <div style={{ marginBottom: "var(--space-8)" }}>
        <h1 style={{ fontSize: "var(--text-3xl)", fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 var(--space-2) 0" }}>Báo cáo Tổng hợp</h1>
        <p style={{ color: "var(--color-foreground-muted)", fontSize: "var(--text-base)", margin: 0 }}>Theo dõi sức khỏe tài chính và hiệu quả kinh doanh</p>
      </div>

      {/* P&L Cards */}
      <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700, marginBottom: "var(--space-4)", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 24 }}>📊</span> Lỗ lãi (P&L)
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "var(--space-3)", marginBottom: "var(--space-8)" }}>
        <StatCard label="Doanh thu" value={Math.round(revenue).toLocaleString("vi-VN") + " đ"} color="var(--color-success)" icon="📈" />
        <StatCard label="Giá vốn" value={Math.round(cogs).toLocaleString("vi-VN") + " đ"} color="var(--color-destructive)" icon="📉" />
        <StatCard label="Lãi gộp" value={Math.round(revenue - cogs).toLocaleString("vi-VN") + " đ"} color="var(--color-primary)" icon="💰" />
        <StatCard label="Chi phí" value={Math.round(totalExpense).toLocaleString("vi-VN") + " đ"} color="var(--color-warning)" icon="💸" />
        <StatCard label="Lãi ròng" value={Math.round(revenue - cogs - totalExpense).toLocaleString("vi-VN") + " đ"} color={revenue - cogs - totalExpense >= 0 ? "var(--color-success)" : "var(--color-destructive)"} icon="💎" />
        <StatCard label="Đơn đã giao" value={String(orderCount)} color="var(--color-foreground)" icon="📦" />
      </div>

      {/* AR/AP */}
      <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700, marginBottom: "var(--space-4)", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 24 }}>⚖️</span> Công nợ
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "var(--space-4)", marginBottom: "var(--space-8)" }}>
        {/* AR Card */}
        <div style={{ background: "linear-gradient(145deg, var(--color-surface), var(--color-surface-hover))", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "var(--space-4)", boxShadow: "var(--shadow-sm)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
             <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--color-success-bg)", color: "var(--color-success)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>📥</div>
             <div>
               <div style={{ fontWeight: 700, fontSize: "var(--text-sm)" }}>Phải thu khách hàng (AR)</div>
               <div style={{ fontSize: "var(--text-xs)", color: "var(--color-foreground-muted)" }}>Các khoản tiền khách hàng đang nợ</div>
             </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "var(--space-1)", gap: 8 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--color-foreground-muted)", marginBottom: 2, fontWeight: 500 }}>Tổng nợ đã xuất</div>
              <div style={{ fontSize: "var(--text-lg)", fontWeight: 700, letterSpacing: "-0.5px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{Math.round(Number(ar._sum.totalAmount ?? 0)).toLocaleString("vi-VN")} đ</div>
            </div>
            <div style={{ textAlign: "right", minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--color-foreground-muted)", marginBottom: 2, fontWeight: 500 }}>Số tiền chưa thu</div>
              <div style={{ fontSize: "var(--text-base)", fontWeight: 700, color: "var(--color-destructive)", letterSpacing: "-0.5px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{Math.round(Number(ar._sum.balanceDue ?? 0)).toLocaleString("vi-VN")} đ</div>
            </div>
          </div>
          <div style={{ width: "100%", height: 6, background: "var(--color-muted)", borderRadius: 3, overflow: "hidden", marginTop: 2 }}>
            <div style={{ width: `${(Number(ar._sum.totalAmount ?? 0) - Number(ar._sum.balanceDue ?? 0)) / (Number(ar._sum.totalAmount ?? 1) || 1) * 100}%`, height: "100%", background: "var(--color-success)", transition: "width 1s ease-out" }} />
          </div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--color-foreground-muted)", textAlign: "right", fontWeight: 500 }}>
            Tỉ lệ thu hồi: <span style={{ color: "var(--color-success)", fontWeight: 700 }}>{(((Number(ar._sum.totalAmount ?? 0) - Number(ar._sum.balanceDue ?? 0)) / (Number(ar._sum.totalAmount ?? 1) || 1)) * 100).toFixed(1)}%</span>
          </div>
        </div>

        {/* AP Card */}
        <div style={{ background: "linear-gradient(145deg, var(--color-surface), var(--color-surface-hover))", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "var(--space-4)", boxShadow: "var(--shadow-sm)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
             <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--color-warning-bg)", color: "var(--color-warning)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>📤</div>
             <div>
               <div style={{ fontWeight: 700, fontSize: "var(--text-sm)" }}>Phải trả nhà cung cấp (AP)</div>
               <div style={{ fontSize: "var(--text-xs)", color: "var(--color-foreground-muted)" }}>Các khoản tiền đang nợ đối tác</div>
             </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "var(--space-1)", gap: 8 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--color-foreground-muted)", marginBottom: 2, fontWeight: 500 }}>Tổng nợ đã nhập</div>
              <div style={{ fontSize: "var(--text-lg)", fontWeight: 700, letterSpacing: "-0.5px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{Math.round(Number(ap._sum.totalAmount ?? 0)).toLocaleString("vi-VN")} đ</div>
            </div>
            <div style={{ textAlign: "right", minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--color-foreground-muted)", marginBottom: 2, fontWeight: 500 }}>Số tiền chưa trả</div>
              <div style={{ fontSize: "var(--text-base)", fontWeight: 700, color: "var(--color-warning)", letterSpacing: "-0.5px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{Math.round(Number(ap._sum.balanceDue ?? 0)).toLocaleString("vi-VN")} đ</div>
            </div>
          </div>
          <div style={{ width: "100%", height: 6, background: "var(--color-muted)", borderRadius: 3, overflow: "hidden", marginTop: 2 }}>
            <div style={{ width: `${(Number(ap._sum.totalAmount ?? 0) - Number(ap._sum.balanceDue ?? 0)) / (Number(ap._sum.totalAmount ?? 1) || 1) * 100}%`, height: "100%", background: "var(--color-warning)", transition: "width 1s ease-out" }} />
          </div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--color-foreground-muted)", textAlign: "right", fontWeight: 500 }}>
            Tiến độ trả nợ: <span style={{ color: "var(--color-warning)", fontWeight: 700 }}>{(((Number(ap._sum.totalAmount ?? 0) - Number(ap._sum.balanceDue ?? 0)) / (Number(ap._sum.totalAmount ?? 1) || 1)) * 100).toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {/* Top Products */}
      <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700, marginBottom: "var(--space-4)", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 24 }}>🔥</span> Top sản phẩm bán chạy
      </h2>
      <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", overflow: "hidden", boxShadow: "var(--shadow-sm)", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)", fontVariantNumeric: "tabular-nums", minWidth: 500 }}>
          <thead><tr style={{ borderBottom: "1px solid var(--color-border)", fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--color-foreground-muted)", textTransform: "uppercase", letterSpacing: "0.05em", background: "var(--color-surface-hover)" }}>
            <th style={{ padding: "var(--space-4) var(--space-5)", textAlign: "center", width: 60 }}>STT</th>
            <th style={{ padding: "var(--space-4) var(--space-5)", textAlign: "left" }}>Tên sản phẩm</th>
            <th style={{ padding: "var(--space-4) var(--space-5)", textAlign: "right" }}>Số lượng đã bán</th>
            <th style={{ padding: "var(--space-4) var(--space-5)", textAlign: "right" }}>Tổng doanh thu</th>
          </tr></thead>
          <tbody>
            {topProducts.length === 0 ? <tr><td colSpan={4} style={{ padding: "var(--space-10)", textAlign: "center", color: "var(--color-foreground-muted)", fontSize: "var(--text-base)" }}>Chưa có dữ liệu đơn hàng thành công</td></tr> :
              topProducts.map((p, i) => (
                <tr key={p.name} style={{ borderBottom: i < topProducts.length - 1 ? "1px solid var(--color-muted)" : "none", background: "var(--color-surface)", transition: "background 0.2s" }}>
                  <td style={{ padding: "var(--space-3) var(--space-5)", textAlign: "center", fontWeight: 600, color: i < 3 ? "var(--color-primary)" : "var(--color-foreground-muted)" }}>
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                  </td>
                  <td style={{ padding: "var(--space-3) var(--space-5)", fontWeight: 600, fontSize: "var(--text-sm)" }}>{p.name}</td>
                  <td style={{ padding: "var(--space-3) var(--space-5)", textAlign: "right", fontWeight: 600 }}>{p.qty}</td>
                  <td style={{ padding: "var(--space-3) var(--space-5)", textAlign: "right", fontWeight: 700, color: "var(--color-success)" }}>{Math.round(Number(p.revenue)).toLocaleString("vi-VN")} đ</td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value, color, icon }: { label: string; value: string; color: string; icon?: string }) {
  return (
    <div style={{ 
      background: "var(--color-surface)", 
      border: "1px solid var(--color-border)", 
      borderRadius: "var(--radius-lg)", 
      padding: "var(--space-4)", 
      boxShadow: "var(--shadow-sm)",
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-2)"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: "var(--text-xs)", color: "var(--color-foreground-muted)", fontWeight: 600 }}>{label}</div>
        {icon && (
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: color + "15", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
            {icon}
          </div>
        )}
      </div>
      <div style={{ fontSize: "var(--text-lg)", fontWeight: 700, color, letterSpacing: "-0.5px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.2 }}>{value}</div>
    </div>
  );
}

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import AdjustForm from "@/components/inventory/AdjustForm";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export default async function ProductDetailPage({ params }: Params) {
  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      inventory: { include: { warehouse: { select: { code: true, name: true } } }, orderBy: { warehouse: { code: "asc" } } },
      movements: { orderBy: { createdAt: "desc" }, take: 50 },
      _count: { select: { salesItems: true, purchaseItems: true } },
    },
  });
  if (!product) notFound();

  const totalStock = product.inventory.reduce((s, inv) => s + inv.quantity, 0);
  const totalValue = product.inventory.reduce((s, inv) => s + Number(inv.avgCost) * inv.quantity, 0);

  return (
    <div>
      <div style={{ marginBottom: "var(--space-6)" }}>
        <Link href="/catalog/product" style={{ fontSize: "var(--text-xs)", color: "var(--color-foreground-muted)" }}>← Danh sách sản phẩm</Link>
        <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, margin: "var(--space-2) 0 0" }}>{product.name}</h1>
        <div style={{ display: "flex", gap: "var(--space-4)", fontSize: "var(--text-sm)", color: "var(--color-foreground-muted)", marginTop: "var(--space-2)" }}>
          <span>📦 SKU: {product.sku}</span>
          <span>📐 {product.unit}</span>
          <span>💰 Giá bán: {Number(product.sellPrice).toLocaleString("vi-VN")} đ</span>
          <span>🏭 Giá nhập: {Number(product.buyPrice).toLocaleString("vi-VN")} đ</span>
        </div>
      </div>

      {/* Inventory Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--space-4)", marginBottom: "var(--space-6)" }}>
        <StatCard label="Tổng tồn kho" value={String(totalStock)} />
        <StatCard label="Giá trị tồn" value={totalValue.toLocaleString("vi-VN") + " đ"} />
        <StatCard label="Lần bán" value={String(product._count.salesItems)} />
        <StatCard label="Lần mua" value={String(product._count.purchaseItems)} />
      </div>

      {/* Inventory by Warehouse */}
      <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 600, marginBottom: "var(--space-3)" }}>Tồn kho theo kho ({product.inventory.length})</h2>
      <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", overflow: "hidden", marginBottom: "var(--space-6)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)", fontVariantNumeric: "tabular-nums" }}>
          <thead><tr style={{ borderBottom: "1px solid var(--color-border)", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-foreground-muted)", textTransform: "uppercase" }}>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center", width: 50 }}>STT</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Kho</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}>Lô</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>SL</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>Giá vốn BQ</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>Giá trị</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>HSD</th>
          </tr></thead>
          <tbody>
            {product.inventory.length === 0 ? <tr><td colSpan={7} style={{ padding: "var(--space-6)", textAlign: "center", color: "var(--color-foreground-muted)" }}>Chưa có tồn kho</td></tr> :
              product.inventory.map((inv, i) => (
                <tr key={inv.id} style={{ borderBottom: i < product.inventory.length - 1 ? "1px solid var(--color-muted)" : "none", background: i % 2 === 0 ? "var(--color-surface)" : "var(--color-surface-hover)" }}>
                  <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}>{i + 1}</td>
                  <td style={{ padding: "var(--space-3) var(--space-4)", fontWeight: 500 }}>{inv.warehouse.code} — {inv.warehouse.name}</td>
                  <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center", fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)" }}>{inv.batchNumber || "—"}</td>
                  <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right", fontWeight: 600 }}>{inv.quantity}</td>
                  <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>{Number(inv.avgCost).toLocaleString("vi-VN")} đ</td>
                  <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right", fontWeight: 600 }}>{(Number(inv.avgCost) * inv.quantity).toLocaleString("vi-VN")} đ</td>
                  <td style={{ padding: "var(--space-3) var(--space-4)", whiteSpace: "nowrap" }}>{inv.expiryDate ? new Date(inv.expiryDate).toLocaleDateString("vi-VN") : "—"}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Adjustment Form */}
      <AdjustForm productId={product.id} warehouses={product.inventory.map(inv => ({ id: inv.warehouseId, code: inv.warehouse.code, name: inv.warehouse.name, qty: inv.quantity }))} />

      {/* Recent Movements */}
      <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 600, marginBottom: "var(--space-3)" }}>Biến động kho gần đây</h2>
      <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)" }}>
          <thead><tr style={{ borderBottom: "1px solid var(--color-border)", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-foreground-muted)", textTransform: "uppercase" }}>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center", width: 50 }}>STT</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Loại</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Lý do</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>SL</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>Đơn giá</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>Tổng</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>Ngày</th>
          </tr></thead>
          <tbody>
            {product.movements.length === 0 ? <tr><td colSpan={7} style={{ padding: "var(--space-6)", textAlign: "center", color: "var(--color-foreground-muted)" }}>Chưa có biến động</td></tr> :
              product.movements.map((m, i) => (
                <tr key={m.id} style={{ borderBottom: i < product.movements.length - 1 ? "1px solid var(--color-muted)" : "none", background: i % 2 === 0 ? "var(--color-surface)" : "var(--color-surface-hover)" }}>
                  <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}>{i + 1}</td>
                  <td style={{ padding: "var(--space-3) var(--space-4)" }}><span style={{ color: m.type === "IN" ? "var(--color-success)" : "var(--color-destructive)", fontWeight: 600 }}>{m.type === "IN" ? "Nhập" : "Xuất"}</span></td>
                  <td style={{ padding: "var(--space-3) var(--space-4)", fontSize: "var(--text-xs)" }}>{m.reason}</td>
                  <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right", fontWeight: 600 }}>{m.quantity}</td>
                  <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>{Number(m.unitCost).toLocaleString("vi-VN")}</td>
                  <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>{Number(m.totalCost).toLocaleString("vi-VN")}</td>
                  <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right", fontSize: "var(--text-xs)", whiteSpace: "nowrap" }}>{new Date(m.createdAt).toLocaleDateString("vi-VN")}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "var(--space-4)" }}>
      <div style={{ fontSize: "var(--text-xs)", color: "var(--color-foreground-muted)" }}>{label}</div>
      <div style={{ fontSize: "var(--text-xl)", fontWeight: 700, marginTop: "var(--space-1)" }}>{value}</div>
    </div>
  );
}

import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { PlusIcon } from "@/components/ui/icons";

export const dynamic = "force-dynamic";

export default async function ProductListPage() {
  const [products, warehouses] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      include: { inventory: { include: { warehouse: { select: { code: true, name: true } } } } },
    }),
    prisma.warehouse.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
  ]);

  // Compute total stock per product across warehouses
  const stockMap = new Map<string, number>();
  for (const p of products) {
    stockMap.set(p.id, p.inventory.reduce((s, inv) => s + inv.quantity, 0));
  }
  const totalStock = [...stockMap.values()].reduce((s, q) => s + q, 0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-5)" }}>
        <div>
          <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, color: "var(--color-foreground)", margin: 0 }}>Sản phẩm & Tồn kho</h1>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-foreground-muted)", marginTop: "var(--space-1)" }}>
            {products.length} sản phẩm · {warehouses.length} kho · Tổng tồn: {totalStock} đơn vị
          </p>
        </div>
        <Link href="/catalog/product/new">
          <Button variant="primary"><PlusIcon size={16} /> Thêm mới</Button>
        </Link>
      </div>

      {/* Table with inventory */}
      <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)", fontVariantNumeric: "tabular-nums" }}>
          <thead><tr style={{ borderBottom: "1px solid var(--color-border)", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-foreground-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>SKU</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Tên sản phẩm</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}>ĐVT</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>Giá bán</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>Giá nhập</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}>Tồn kho</th>
            <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center", width: 180 }}></th>
          </tr></thead>
          <tbody>
            {products.length === 0 ? <tr><td colSpan={7} style={{ padding: "var(--space-10)", textAlign: "center", color: "var(--color-foreground-muted)" }}>Chưa có sản phẩm</td></tr> :
              products.map((p, i) => {
                const stock = stockMap.get(p.id) ?? 0;
                return (
                  <tr key={p.id} style={{ borderBottom: i < products.length - 1 ? "1px solid var(--color-muted)" : "none", background: i % 2 === 0 ? "var(--color-surface)" : "var(--color-surface-hover)" }}>
                    <td style={{ padding: "var(--space-3) var(--space-4)", fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)" }}>{p.sku}</td>
                    <td style={{ padding: "var(--space-3) var(--space-4)", fontWeight: 500 }}>
                      <Link href={`/products/${p.id}`} style={{ color: "var(--color-primary)", textDecoration: "none" }}>{p.name}</Link>
                    </td>
                    <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}>{p.unit}</td>
                    <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right", fontWeight: 600 }}>{Number(p.sellPrice).toLocaleString("vi-VN")} đ</td>
                    <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>{Number(p.buyPrice).toLocaleString("vi-VN")} đ</td>
                    <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}>
                      <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: "var(--radius-sm)", fontSize: "var(--text-xs)", fontWeight: 700, background: stock > 0 ? "var(--color-success-bg)" : "var(--color-muted)", color: stock > 0 ? "var(--color-success)" : "var(--color-foreground-muted)" }}>
                        {stock}
                      </span>
                    </td>
                    <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center", whiteSpace: "nowrap" }}>
                      <Link href={`/products/${p.id}`}><Button variant="ghost" size="sm">Xem</Button></Link>
                      <Link href={`/catalog/product/${p.id}/edit`}><Button variant="ghost" size="sm">Sửa</Button></Link>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

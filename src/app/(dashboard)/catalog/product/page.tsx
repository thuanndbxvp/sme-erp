import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { PlusIcon } from "@/components/ui/icons";
import { Pagination } from "@/components/ui/Pagination";
import AdjustForm from "@/components/inventory/AdjustForm";
import QuickEditProductForm from "@/components/catalog/QuickEditProductForm";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

type Props = { searchParams: Promise<{ page?: string }> };

export default async function ProductListPage({ searchParams }: Props) {
  const p = parseInt((await searchParams).page ?? "1", 10) || 1;
  const skip = (p - 1) * PAGE_SIZE;

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      skip, take: PAGE_SIZE,
      include: { inventory: { include: { warehouse: { select: { code: true, name: true } } } } },
    }),
    prisma.product.count({ where: { isActive: true } }),
  ]);

  const stockMap = new Map<string, number>();
  for (const prod of products) stockMap.set(prod.id, prod.inventory.reduce((s, inv) => s + inv.quantity, 0));
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-5)" }}>
        <div>
          <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, margin: 0 }}>Sản phẩm & Tồn kho</h1>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-foreground-muted)", marginTop: "var(--space-1)" }}>{total} sản phẩm · Trang {p}/{totalPages}</p>
        </div>
        <Link href="/catalog/product/new"><Button variant="primary"><PlusIcon size={16} /> Thêm mới</Button></Link>
      </div>

      <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
        <div style={{ maxHeight: "calc(100vh - 280px)", overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)", fontVariantNumeric: "tabular-nums" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
              <tr style={{ borderBottom: "1px solid var(--color-border)", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-foreground-muted)", textTransform: "uppercase", letterSpacing: "0.05em", background: "var(--color-surface)" }}>
                <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center", width: 50 }}>STT</th>
                <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>SKU</th>
                <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Tên</th>
                <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}>ĐVT</th>
                <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>Giá bán</th>
                <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}>Tồn</th>
                <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center", width: 140 }}></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p2, i) => {
                const stock = stockMap.get(p2.id) ?? 0;
                return (
                  <tr key={p2.id} style={{ borderBottom: i < products.length - 1 ? "1px solid var(--color-muted)" : "none", background: i % 2 === 0 ? "var(--color-surface)" : "var(--color-surface-hover)" }}>
                    <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}>{(p - 1) * PAGE_SIZE + i + 1}</td>
                    <td style={{ padding: "var(--space-3) var(--space-4)", fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)" }}>{p2.sku}</td>
                    <td style={{ padding: "var(--space-3) var(--space-4)", fontWeight: 500 }}><Link href={`/products/${p2.id}`} style={{ color: "var(--color-primary)", textDecoration: "none" }}>{p2.name}</Link></td>
                    <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}>{p2.unit}</td>
                    <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right", fontWeight: 600 }}>{Number(p2.sellPrice).toLocaleString("vi-VN")} đ</td>
                    <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}>
                      <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: "var(--radius-sm)", fontSize: "var(--text-xs)", fontWeight: 700, background: stock > 0 ? "var(--color-success-bg)" : "var(--color-muted)", color: stock > 0 ? "var(--color-success)" : "var(--color-foreground-muted)" }}>{stock}</span>
                    </td>
                    <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "flex-end", alignItems: "center" }}>
                        <Link href={`/products/${p2.id}`}>
                          <button style={{ height: 32, padding: "0 12px", borderRadius: "var(--radius-md)", fontSize: "var(--text-xs)", fontWeight: 600, cursor: "pointer", border: "1px solid var(--color-primary)", background: "var(--color-surface)", color: "var(--color-primary)", display: "flex", alignItems: "center", gap: 6 }}>
                            👁 Xem
                          </button>
                        </Link>
                        <QuickEditProductForm product={{
                          id: p2.id,
                          name: p2.name,
                          unit: p2.unit,
                          buyPrice: Number(p2.buyPrice),
                          sellPrice: Number(p2.sellPrice)
                        }} />
                        <AdjustForm
                          productId={p2.id}
                          warehouses={p2.inventory.map(inv => ({ id: inv.warehouseId, code: inv.warehouse.code, name: inv.warehouse.name, qty: inv.quantity }))}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <Pagination currentPage={p} totalPages={totalPages} />
    </div>
  );
}

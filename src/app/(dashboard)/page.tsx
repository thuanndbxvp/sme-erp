import { prisma } from "@/lib/prisma";
import { CATALOG_ENTITIES, CATALOG_REGISTRY } from "@/domain/catalog-registry";
import { catalogIcon } from "@/components/ui/icons";
import { StatsRow } from "@/components/dashboard/StatsRow";
import { CatalogCard } from "@/components/dashboard/CatalogCard";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [productCount, customerCount, supplierCount, warehouseCount, orderCount] =
    await Promise.all([
      prisma.product.count({ where: { isActive: true } }),
      prisma.customer.count({ where: { isActive: true } }),
      prisma.supplier.count({ where: { isActive: true } }),
      prisma.warehouse.count({ where: { isActive: true } }),
      prisma.salesOrder.count({ where: { status: "DELIVERED" } }),
    ]);

  return (
    <div>
      <div style={{ marginBottom: "var(--space-6)" }}>
        <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, color: "var(--color-foreground)", margin: 0 }}>
          Tổng quan
        </h1>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--color-foreground-muted)", marginTop: "var(--space-1)" }}>
          Hệ thống quản lý thương mại — mua, bán, kho, công nợ, dòng tiền
        </p>
      </div>

      <StatsRow
        productCount={productCount}
        customerCount={customerCount}
        supplierCount={supplierCount}
        warehouseCount={warehouseCount}
        orderCount={orderCount}
      />

      <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 600, marginBottom: "var(--space-4)", color: "var(--color-foreground)" }}>
        Danh mục
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "var(--space-4)" }}>
        {CATALOG_ENTITIES.map((e) => {
          const Icon = catalogIcon(e);
          const cfg = CATALOG_REGISTRY[e];
          return (
            <CatalogCard
              key={e}
              href={`/catalog/${e}`}
              icon={<Icon size={20} />}
              title={cfg.labelPlural}
              desc={`Quản lý danh mục ${cfg.labelPlural.toLowerCase()}`}
            />
          );
        })}
      </div>

      <div style={{ marginTop: "var(--space-12)", padding: "var(--space-4) var(--space-6)", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", fontSize: "var(--text-xs)", color: "var(--color-foreground-muted)", display: "flex", gap: "var(--space-8)" }}>
        <span>SME ERP v0.1</span>
        <span>Next.js 15 + React 19 + Prisma + PostgreSQL</span>
      </div>
    </div>
  );
}

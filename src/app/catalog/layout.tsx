import Link from "next/link";
import type { ReactNode } from "react";
import { CATALOG_ENTITIES, CATALOG_REGISTRY } from "@/domain/catalog-registry";

/** Layout danh mục: nav sang 5 loại danh mục. */
export default function CatalogLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 24, padding: 24 }}>
      <nav style={{ display: "grid", gap: 8, minWidth: 160 }}>
        <strong>Danh mục</strong>
        {CATALOG_ENTITIES.map((e) => (
          <Link key={e} href={`/catalog/${e}`}>
            {CATALOG_REGISTRY[e].labelPlural}
          </Link>
        ))}
      </nav>
      <section style={{ flex: 1 }}>{children}</section>
    </div>
  );
}

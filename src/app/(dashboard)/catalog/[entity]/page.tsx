import { notFound } from "next/navigation";
import { CATALOG_REGISTRY, isCatalogEntity } from "@/domain/catalog-registry";
import { CatalogTable } from "@/components/catalog/CatalogTable";
import { serializeRow } from "@/components/catalog/serialize";
import { deactivateCatalogItem } from "@/app/actions/catalog";

/** List danh mục theo [entity]. Server component: đọc qua service, render bảng. */
export default async function CatalogListPage({
  params,
}: {
  params: Promise<{ entity: string }>;
}) {
  const { entity } = await params;
  if (!isCatalogEntity(entity)) {
    notFound();
  }
  const cfg = CATALOG_REGISTRY[entity];
  const records = await cfg.service.list();
  const rows = records.map((r) => serializeRow(r, cfg.fields));

  async function deactivate(id: string) {
    "use server";
    return deactivateCatalogItem(cfg.entity, id);
  }

  return (
    <CatalogTable
      entity={cfg.entity}
      labelPlural={cfg.labelPlural}
      fields={cfg.fields}
      rows={rows}
      deactivate={deactivate}
    />
  );
}

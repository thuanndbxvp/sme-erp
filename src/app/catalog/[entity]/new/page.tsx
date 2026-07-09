import { notFound } from "next/navigation";
import { CATALOG_REGISTRY, isCatalogEntity } from "@/domain/catalog-registry";
import { CatalogForm } from "@/components/catalog/CatalogForm";
import { createCatalogItem } from "@/app/actions/catalog";

/** Trang tạo mới danh mục theo [entity]. */
export default async function CatalogNewPage({
  params,
}: {
  params: Promise<{ entity: string }>;
}) {
  const { entity } = await params;
  if (!isCatalogEntity(entity)) {
    notFound();
  }
  const cfg = CATALOG_REGISTRY[entity];

  async function action(formData: FormData) {
    "use server";
    return createCatalogItem(cfg.entity, formData);
  }

  return (
    <CatalogForm
      entity={cfg.entity}
      labelPlural={cfg.label}
      fields={cfg.fields}
      mode="create"
      action={action}
    />
  );
}

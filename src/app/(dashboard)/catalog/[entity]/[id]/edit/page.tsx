import { notFound } from "next/navigation";
import { CATALOG_REGISTRY, isCatalogEntity } from "@/domain/catalog-registry";
import { CatalogForm } from "@/components/catalog/CatalogForm";
import { serializeRow } from "@/components/catalog/serialize";
import { updateCatalogItem } from "@/app/actions/catalog";
import { NotFoundError } from "@/domain/errors";

/** Trang sửa danh mục theo [entity]/[id]. */
export default async function CatalogEditPage({
  params,
}: {
  params: Promise<{ entity: string; id: string }>;
}) {
  const { entity, id } = await params;
  if (!isCatalogEntity(entity)) {
    notFound();
  }
  const cfg = CATALOG_REGISTRY[entity];

  let record: Record<string, unknown>;
  try {
    record = await cfg.service.findByIdOrThrow(id);
  } catch (err) {
    if (err instanceof NotFoundError) {
      notFound();
    }
    throw err;
  }
  const initial = serializeRow(record, cfg.fields);

  async function action(formData: FormData) {
    "use server";
    return updateCatalogItem(cfg.entity, id, formData);
  }

  return (
    <CatalogForm
      entity={cfg.entity}
      labelPlural={cfg.label}
      fields={cfg.fields}
      mode="edit"
      initial={initial}
      action={action}
    />
  );
}

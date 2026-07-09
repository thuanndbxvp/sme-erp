"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/authorize";
import { safeAction, type ActionResult } from "@/lib/action-result";
import {
  CATALOG_REGISTRY,
  isCatalogEntity,
  type CatalogEntity,
} from "@/domain/catalog-registry";
import { ValidationError } from "@/domain/errors";

/**
 * Server actions danh mục — MỎNG: chỉ kiểm quyền + validate (zod) + gọi service.
 * Business logic nằm ở service (Mục A). Không tin client — input luôn qua zod.
 */

function configOf(entity: string) {
  if (!isCatalogEntity(entity)) {
    throw new ValidationError(`Danh mục không hợp lệ: ${entity}`);
  }
  return CATALOG_REGISTRY[entity];
}

async function currentUserId(): Promise<string | null | undefined> {
  const session = await auth();
  return session?.user?.id;
}

/** Chuyển FormData → object thô (chuỗi). zod ở service-layer sẽ validate/transform. */
function formToObject(formData: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    obj[key] = typeof value === "string" ? value : undefined;
  }
  return obj;
}

export async function createCatalogItem(
  entity: CatalogEntity,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  return safeAction(async () => {
    const cfg = configOf(entity);
    await requirePermission(await currentUserId(), cfg.permissionWrite);
    const input = cfg.createSchema.parse(formToObject(formData));
    const created = await cfg.service.create(input as never);
    revalidatePath(`/catalog/${entity}`);
    return { id: created.id };
  });
}

export async function updateCatalogItem(
  entity: CatalogEntity,
  id: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  return safeAction(async () => {
    const cfg = configOf(entity);
    await requirePermission(await currentUserId(), cfg.permissionWrite);
    const input = cfg.updateSchema.parse(formToObject(formData));
    const updated = await cfg.service.update(id, input as never);
    revalidatePath(`/catalog/${entity}`);
    return { id: updated.id };
  });
}

export async function deactivateCatalogItem(
  entity: CatalogEntity,
  id: string,
): Promise<ActionResult<{ id: string }>> {
  return safeAction(async () => {
    const cfg = configOf(entity);
    await requirePermission(await currentUserId(), cfg.permissionWrite);
    const result = await cfg.service.deactivate(id);
    revalidatePath(`/catalog/${entity}`);
    return { id: result.id };
  });
}

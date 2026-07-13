"use server";

import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/authorize";
import { safeAction } from "@/lib/action-result";
import { InventoryService } from "@/services/inventory.service";
import { revalidatePath } from "next/cache";

/**
 * Điều chỉnh tồn kho thủ công (hàng hỏng, khuyến mãi, kiểm kê...).
 * Form truyền `quantity` = SỐ LƯỢNG MỚI (sau điều chỉnh), `reason` = lý do bắt buộc.
 * Yêu cầu quyền: inventory.adjust
 */
export async function adjustInventory(formData: FormData) {
  const session = await auth();
  await requirePermission(session?.user?.id, "inventory.adjust");

  const productId = formData.get("productId") as string;
  const warehouseId = formData.get("warehouseId") as string;
  const newQuantity = parseInt(formData.get("quantity") as string, 10);
  const reason = (formData.get("reason") as string) || "";

  return safeAction(async () => {
    await InventoryService.adjustInventoryInTransaction({
      productId,
      warehouseId,
      newQuantity,
      reason,
    });

    revalidatePath(`/products/${productId}`);
    revalidatePath("/catalog/product");
    return { ok: true };
  });
}

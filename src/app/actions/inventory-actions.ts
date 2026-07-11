"use server";

import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/authorize";
import { auditLog } from "@/lib/audit";
import { safeAction } from "@/lib/action-result";
import { InventoryService } from "@/services/inventory.service";
import { prisma } from "@/lib/prisma";
import { MOVEMENT_TYPE, MOVEMENT_REASON, REFERENCE_TYPE } from "@/domain/constants";
import { revalidatePath } from "next/cache";

/**
 * Điều chỉnh tồn kho thủ công (hàng hỏng, khuyến mãi, kiểm kê...).
 * Yêu cầu quyền: inventory.adjust
 */
export async function adjustInventory(formData: FormData) {
  const session = await auth();
  await requirePermission(session?.user?.id, "inventory.adjust");

  const productId = formData.get("productId") as string;
  const warehouseId = formData.get("warehouseId") as string;
  const quantity = parseInt(formData.get("quantity") as string, 10);
  const direction = formData.get("direction") as string; // "IN" | "OUT"
  const reason2 = (formData.get("reason") as string) || "";
  const note = (formData.get("note") as string) || "";

  return safeAction(async () => {
    const reason = direction === "IN" ? MOVEMENT_REASON.ADJUST_IN : MOVEMENT_REASON.ADJUST_OUT;
    const refId = `ADJ-${Date.now()}-${Math.random().toFixed(3)}`;

    await InventoryService.recordMovementInTransaction({
      type: direction === "IN" ? MOVEMENT_TYPE.IN : MOVEMENT_TYPE.OUT,
      reason,
      productId,
      warehouseId,
      quantity,
      unitCost: "0", // adjustment doesn't change WAC
      referenceType: REFERENCE_TYPE.ADJUSTMENT,
      referenceId: refId,
    });

    const product = await prisma.product.findUnique({ where: { id: productId } });
    await auditLog({
      action: direction === "IN" ? "ADJUST_STOCK_IN" : "ADJUST_STOCK_OUT",
      entityType: "Product",
      entityId: productId,
      userId: session?.user?.id,
      metadata: { productName: product?.name, quantity, direction, reason2: reason2 || reason, note, warehouseId },
    });

    revalidatePath(`/products/${productId}`);
    revalidatePath("/catalog/product");
    return { ok: true };
  });
}

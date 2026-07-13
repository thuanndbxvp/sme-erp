"use server";

import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/authorize";
import { OrderOrchestrator } from "@/services/order-orchestrator.service";
import { safeAction } from "@/lib/action-result";
import { revalidatePath } from "next/cache";

/**
 * Server actions cho tính năng Lean Order Management (MSEW-lean-order-management).
 * Bọc OrderOrchestrator.updateSalesOrder / updatePurchaseOrder với RBAC +
 * safeAction để UI hiển thị lỗi thân thiện.
 *
 * - `sales.order.edit` / `purchase.order.edit` là các permission code trong bảng
 *   Permission. Admin hoặc vai trò có quyền tương đương mới gọi được.
 */

/** Sửa đơn bán (Auto-Delta kho + quỹ). */
export async function editSalesOrderAction(id: string, data: {
  items: Array<{
    productId?: string | null;
    productName: string;
    unit: string;
    qty: number;
    sellPrice: string;
    baseCost: string;
    taxAmount?: string;
  }>;
  /** Quỹ dùng để hoàn tiền dư nếu balanceDue bị âm. Optional. */
  refundAccountId?: string;
}) {
  const session = await auth();
  await requirePermission(session?.user?.id, "sales.order.edit");
  return safeAction(async () => {
    const so = await OrderOrchestrator.updateSalesOrder(
      id,
      { items: data.items },
      {
        userId: session?.user?.id,
        now: new Date(),
        refundAccountId: data.refundAccountId,
      },
    );
    revalidatePath("/orders");
    revalidatePath("/cashflow");
    revalidatePath("/debts");
    return { id: so.id, orderCode: so.orderCode };
  });
}

/** Sửa đơn mua (Auto-Delta kho). */
export async function editPurchaseOrderAction(id: string, data: {
  items: Array<{
    productId?: string | null;
    productName: string;
    unit: string;
    qty: number;
    buyPrice: string;
    taxAmount?: string;
  }>;
}) {
  const session = await auth();
  await requirePermission(session?.user?.id, "purchase.order.edit");
  return safeAction(async () => {
    const po = await OrderOrchestrator.updatePurchaseOrder(
      id,
      { items: data.items },
      {
        userId: session?.user?.id,
        now: new Date(),
      },
    );
    revalidatePath("/orders");
    revalidatePath("/cashflow");
    revalidatePath("/debts");
    return { id: po.id, orderCode: po.orderCode };
  });
}
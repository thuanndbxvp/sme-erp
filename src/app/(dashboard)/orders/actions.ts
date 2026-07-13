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
  /** Sửa lại ngày bán (backdate). Yêu cầu quyền `order.edit_date`. Optional. */
  saleDate?: string;
}) {
  const session = await auth();
  await requirePermission(session?.user?.id, "sales.order.edit");
  if (data.saleDate) {
    await requirePermission(session?.user?.id, "order.edit_date");
  }
  return safeAction(async () => {
    const so = await OrderOrchestrator.updateSalesOrder(
      id,
      {
        items: data.items,
        ...(data.saleDate ? { saleDate: new Date(data.saleDate) } : {}),
      },
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
  /** Sửa lại ngày nhập (backdate). Yêu cầu quyền `order.edit_date`. Optional. */
  orderDate?: string;
}) {
  const session = await auth();
  await requirePermission(session?.user?.id, "purchase.order.edit");
  if (data.orderDate) {
    await requirePermission(session?.user?.id, "order.edit_date");
  }
  return safeAction(async () => {
    const po = await OrderOrchestrator.updatePurchaseOrder(
      id,
      {
        items: data.items,
        ...(data.orderDate ? { orderDate: new Date(data.orderDate) } : {}),
      },
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
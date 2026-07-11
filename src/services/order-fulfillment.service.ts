import type { PrismaClient } from "@prisma/client";
import { InventoryService } from "@/services/inventory.service";
import { PurchaseOrderService } from "@/services/purchase-order.service";
import { FULFILLMENT_TYPE, MOVEMENT_TYPE, MOVEMENT_REASON, REFERENCE_TYPE } from "@/domain/constants";
import { NotFoundError } from "@/domain/errors";

type TxClient = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

export interface FulfillmentMeta {
  userId?: string;
  note?: string;
}

/**
 * OrderFulfillmentService — logic xuất/nhập/hoàn kho cho đơn hàng.
 * Tách từ OrderOrchestrator (P2-3/P2-4).
 */
export class OrderFulfillmentService {

  /** Xuất kho khi giao hàng (WAREHOUSE) hoặc movement ảo (DROPSHIP). */
  static async shipItems(
    tx: TxClient,
    salesOrderId: string,
    _meta: FulfillmentMeta = {},
  ) {
    void _meta;
    const order = await tx.salesOrder.findUniqueOrThrow({
      where: { id: salesOrderId },
      include: { items: true },
    });
    const isDropship = order.fulfillmentType === FULFILLMENT_TYPE.DROPSHIP;

    for (const item of order.items) {
      if (!item.productId) continue;

      const moveInput = {
        type: MOVEMENT_TYPE.OUT,
        reason: MOVEMENT_REASON.SALES_SHIPMENT,
        productId: item.productId,
        warehouseId: order.warehouseId ?? "",
        quantity: item.qty,
        unitCost: item.baseCost.toString(),
        referenceType: REFERENCE_TYPE.SALES_ORDER,
        referenceId: `${salesOrderId}-${item.id}`,
      };

      if (isDropship) {
        await InventoryService.recordVirtualMovement(tx, { ...moveInput, reason: MOVEMENT_REASON.DROPSHIP_OUT });
      } else {
        await InventoryService.recordMovement(tx, moveInput);
      }
    }
  }

  /** Hoàn kho khi hủy đơn bán đã DELIVERED. */
  static async returnSalesItems(
    tx: TxClient,
    salesOrderId: string,
    fulfillmentType: string,
    warehouseId: string | null,
    _meta: FulfillmentMeta = {},
  ) {
    void _meta;
    const items = await tx.salesOrderItem.findMany({ where: { salesOrderId } });
    const isDropship = fulfillmentType === "DROPSHIP";

    for (const item of items) {
      if (!item.productId) continue;

      const moveInput = {
        type: MOVEMENT_TYPE.IN,
        reason: MOVEMENT_REASON.RETURN_IN,
        productId: item.productId,
        warehouseId: warehouseId ?? "",
        quantity: item.qty,
        unitCost: item.baseCost.toString(),
        referenceType: REFERENCE_TYPE.SALES_ORDER,
        referenceId: `cancel-${salesOrderId}-${item.id}`,
      };

      if (isDropship) {
        await InventoryService.recordVirtualMovement(tx, { ...moveInput, reason: MOVEMENT_REASON.RETURN_IN });
      } else {
        await InventoryService.recordMovement(tx, moveInput);
      }
    }
  }

  /** Nhập kho khi nhận hàng PO. */
  static async receiveItems(
    tx: TxClient,
    purchaseOrderId: string,
    _meta: FulfillmentMeta = {},
  ) {
    void _meta;
    const order = await tx.purchaseOrder.findUniqueOrThrow({
      where: { id: purchaseOrderId },
      include: { items: true },
    });

    for (const item of order.items) {
      if (!item.productId || !order.warehouseId) continue;

      await InventoryService.recordMovement(tx, {
        type: MOVEMENT_TYPE.IN,
        reason: MOVEMENT_REASON.PURCHASE_RECEIPT,
        productId: item.productId,
        warehouseId: order.warehouseId,
        quantity: item.qty,
        unitCost: item.buyPrice.toString(),
        referenceType: REFERENCE_TYPE.PURCHASE_ORDER,
        referenceId: `${purchaseOrderId}-${item.id}`,
      });
    }
  }

  /** Hoàn kho khi hủy PO đã RECEIVED. */
  static async returnPurchaseItems(
    tx: TxClient,
    purchaseOrderId: string,
    warehouseId: string | null,
    _meta: FulfillmentMeta = {},
  ) {
    void _meta;
    const items = await tx.purchaseOrderItem.findMany({ where: { purchaseOrderId } });
    if (!warehouseId) return;

    for (const item of items) {
      if (!item.productId) continue;

      await InventoryService.recordMovement(tx, {
        type: MOVEMENT_TYPE.OUT,
        reason: MOVEMENT_REASON.RETURN_OUT,
        productId: item.productId,
        warehouseId,
        quantity: item.qty,
        unitCost: item.buyPrice.toString(),
        referenceType: REFERENCE_TYPE.PURCHASE_ORDER,
        referenceId: `cancel-${purchaseOrderId}-${item.id}`,
      });
    }
  }
}

/** Internal: đổi trạng thái + nhập kho (gọi từ orchestrator và dropship delivery). */
export async function receivePurchaseOrderInternal(
  tx: TxClient,
  purchaseOrderId: string,
  meta: FulfillmentMeta,
) {
  const locked = await tx.$queryRaw<
    Array<{ id: string; status: string; warehouseId: string | null }>
  >`SELECT "id","status","warehouseId" FROM "PurchaseOrder" WHERE "id"=${purchaseOrderId} FOR UPDATE`;
  const row = locked[0];
  if (!row) throw new NotFoundError("Đơn mua", purchaseOrderId);

  if (row.status === "RECEIVED") {
    return tx.purchaseOrder.findUniqueOrThrow({
      where: { id: purchaseOrderId },
      include: { items: true },
    });
  }

  await PurchaseOrderService.updateStatus(tx, purchaseOrderId, "RECEIVED", {
    userId: meta.userId,
    note: "Nhận hàng",
  });

  await OrderFulfillmentService.receiveItems(tx, purchaseOrderId, meta);

  return tx.purchaseOrder.findUniqueOrThrow({
    where: { id: purchaseOrderId },
    include: { items: true },
  });
}

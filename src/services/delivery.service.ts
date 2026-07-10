import type { PrismaClient } from "@prisma/client";
import { InventoryService } from "@/services/inventory.service";
import { OutboxService } from "@/services/outbox.service";
import { MOVEMENT_REASON, MOVEMENT_TYPE, REFERENCE_TYPE, FULFILLMENT_TYPE } from "@/domain/constants";
import { logger } from "@/lib/logger";

/**
 * DeliveryService (P2-3) — Giao hàng, side-effect kho qua outbox.
 *
 * Khi SO chuyển DELIVERED:
 * - WAREHOUSE: xuất kho từng item (SALES_SHIPMENT) tại warehouseId của SO.
 *   Dùng InventoryService.recordMovement → giảm tồn + idempotent.
 * - DROPSHIP: tạo movement DROPSHIP_OUT (xuất ảo, KHÔNG ảnh hưởng tồn thật).
 *   Ghi trực tiếp InventoryMovement (không qua InventoryService vì không có warehouse
 *   thật). Idempotent nhờ @@unique([referenceType, referenceId, reason, productId]).
 *
 * Quy trình:
 *   1. Orchestrator gọi registerDeliveryEvent + updateStatus (cùng transaction)
 *   2. Outbox worker gọi processDelivery
 *   3. processDelivery → handleDelivery → recordMovement cho từng item
 */

type TxClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export class DeliveryService {
  /**
   * Tạo outbox event SALES_DELIVERY, PHẢI gọi TRONG cùng transaction với
   * SalesOrderService.updateStatus(tx, id, "DELIVERED", ...).
   * Idempotent theo idempotencyKey = `delivery:${soId}`.
   */
  static async registerDeliveryEvent(
    tx: TxClient,
    salesOrderId: string,
    meta: { userId?: string } = {},
  ) {
    await OutboxService.create(tx, {
      type: "SALES_DELIVERY",
      payload: { salesOrderId, userId: meta.userId ?? null },
      idempotencyKey: `delivery:${salesOrderId}`,
    });
  }

  /**
   * Xử lý 1 outbox event SALES_DELIVERY.
   * Gọi sau khi outbox worker getPending + lấy event.
   *
   * Khi handleDelivery fail trong transaction → toàn bộ rollback (inventory không đổi).
   * Sau đó gọi markFailed ở transaction riêng → tăng attempts + retry backoff.
   */
  static async processDelivery(prisma: PrismaClient, eventId: string) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const event = await tx.outboxEvent.findUniqueOrThrow({
            where: { id: eventId },
          });
          const payload = event.payload as {
            salesOrderId: string;
            userId?: string | null;
          };

          await DeliveryService.handleDelivery(tx, payload.salesOrderId);

          await OutboxService.markDone(tx, eventId);
        },
        // Remote DB: nới timeout
        { maxWait: 15_000, timeout: 20_000 },
      );
    } catch (error) {
      // Transaction đã rollback hoàn toàn → inventory không thay đổi.
      // Gọi markFailed riêng (transaction khác) để tăng attempts + retry backoff.
      await OutboxService.markFailed(
        prisma,
        eventId,
        new Date(),
        String(error),
      ).catch((mfErr) => {
        // Không che lấp lỗi gốc
        logger.error({ err: mfErr }, "markFailed cũng thất bại");
      });
      throw error;
    }
  }

  /**
   * Core logic: xuất kho / ghi movement cho 1 SO.
   * Có thể gọi trực tiếp (test) hoặc qua processDelivery (production).
   * Idempotent nhờ InventoryMovement.@@unique.
   */
  static async handleDelivery(tx: TxClient, salesOrderId: string) {
    const so = await tx.salesOrder.findUniqueOrThrow({
      where: { id: salesOrderId },
      include: { items: true },
    });

    if (so.fulfillmentType === FULFILLMENT_TYPE.WAREHOUSE) {
      if (!so.warehouseId) {
        throw new Error("WAREHOUSE order must have warehouseId");
      }
      for (const item of so.items) {
        if (!item.productId) continue;

        // Gọi InventoryService → validate tồn + cập nhật avgCost + idempotent
        await InventoryService.recordMovement(tx, {
          type: MOVEMENT_TYPE.OUT,
          reason: MOVEMENT_REASON.SALES_SHIPMENT,
          productId: item.productId,
          warehouseId: so.warehouseId,
          quantity: item.qty,
          unitCost: item.baseCost.toString(),
          referenceType: REFERENCE_TYPE.SALES_ORDER,
          referenceId: so.id,
        });

        // Cập nhật profit = sellTotal - (baseCost * qty)
        await updateItemProfit(tx, item.id, item.sellTotal.toString(), item.baseCost.toString(), item.qty);
      }
    } else {
      // DROPSHIP: xuất ảo (DROPSHIP_OUT), warehouseId = null (không ảnh hưởng tồn thật)
      for (const item of so.items) {
        if (!item.productId) continue;

        // Ghi trực tiếp InventoryMovement với warehouseId = null
        // Không qua InventoryService vì không có kho thật
        await recordDropshipOutMovement(tx, {
          productId: item.productId,
          quantity: item.qty,
          unitCost: item.baseCost.toString(),
          referenceId: so.id,
        });

        // Cập nhật profit
        await updateItemProfit(tx, item.id, item.sellTotal.toString(), item.baseCost.toString(), item.qty);
      }
    }
  }
}

// ==================== Helpers ====================

interface DropshipOutInput {
  productId: string;
  quantity: number;
  unitCost: string;
  referenceId: string;
}

/**
 * Ghi 1 movement DROPSHIP_OUT (xuất ảo). Không ảnh hưởng WarehouseInventory.
 * Idempotent: nếu đã có movement với (SALES_ORDER, referenceId, DROPSHIP_OUT, productId) → return.
 */
async function recordDropshipOutMovement(tx: TxClient, input: DropshipOutInput) {
  const referenceType = REFERENCE_TYPE.SALES_ORDER;
  const reason = MOVEMENT_REASON.DROPSHIP_OUT;

  const existing = await tx.inventoryMovement.findUnique({
    where: {
      referenceType_referenceId_reason_productId: {
        referenceType,
        referenceId: input.referenceId,
        reason,
        productId: input.productId,
      },
    },
  });
  if (existing) {
    return existing;
  }

  const unitCost = input.unitCost;
  const totalCost = (Number(unitCost) * input.quantity).toString();

  return tx.inventoryMovement.create({
    data: {
      type: MOVEMENT_TYPE.OUT,
      reason,
      productId: input.productId,
      warehouseId: null,
      quantity: input.quantity,
      unitCost,
      totalCost,
      referenceType,
      referenceId: input.referenceId,
    },
  });
}

/**
 * Cập nhật profit cho SalesOrderItem.
 * profit = sellTotal - (baseCost * qty)
 */
async function updateItemProfit(
  tx: TxClient,
  itemId: string,
  sellTotal: string,
  baseCost: string,
  qty: number,
) {
  const sellNum = Number(sellTotal);
  const costNum = Number(baseCost) * qty;
  const profit = (sellNum - costNum).toString();

  await tx.salesOrderItem.update({
    where: { id: itemId },
    data: { profit },
  });
}
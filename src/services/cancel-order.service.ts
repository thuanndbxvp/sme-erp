/**
 * CancelOrderService (P2-4, invariants C3/C4/C5).
 *
 * Xử lý hủy đơn bán (SalesOrder), bao gồm:
 * - WAREHOUSE PENDING → CANCELLED: chỉ đổi status, không chạm kho.
 * - WAREHOUSE DELIVERED → CANCELLED: hoàn kho (IN) các item đã xuất.
 * - DROPSHIP PENDING → CANCELLED: huỷ cả PO liên kết (nếu PO chưa RECEIVED).
 * - DROPSHIP DELIVERED + PO RECEIVED: hoàn kho cả 2 chiều.
 *
 * Mọi thao tác trong 1 transaction với FOR UPDATE.
 */
import type { PrismaClient, SalesOrder, PurchaseOrder, $Enums } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { NotFoundError } from "@/domain/errors";
import { InventoryService } from "@/services/inventory.service";
import { assertTransition, SALES_ORDER_TRANSITIONS, PURCHASE_ORDER_TRANSITIONS } from "@/domain/state-machine";
import { MOVEMENT_REASON, REFERENCE_TYPE } from "@/domain/constants";

type TxClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export interface CancelOrderMeta {
  userId?: string;
  note?: string;
}

export class CancelOrderService {
  /**
   * Hủy đơn bán (SalesOrder) — atomic trong 1 transaction.
   *
   * Luồng:
   * 1. FOR UPDATE SO + items
   * 2. Validate state machine: chỉ cancel từ PENDING hoặc DELIVERED
   * 3. Nếu WAREHOUSE + DELIVERED → hoàn kho (IN) mỗi item
   * 4. Nếu DROPSHIP:
   *    a. Cancel PO liên kết (nếu chưa CANCELLED)
   *    b. Nếu PO RECEIVED → hoàn kho ngược: CANCEL_PURCHASE (OUT)
   *    c. Nếu SO DELIVERED → hoàn kho DROPSHIP_OUT ngược = CANCEL_SALE (IN)
   * 5. Ghi history → update status
   */
  static async cancelSalesOrder(
    id: string,
    meta: CancelOrderMeta = {},
    prisma: PrismaClient = defaultPrisma,
  ): Promise<SalesOrder> {
    return prisma.$transaction(async (tx) => {
      // 1. FOR UPDATE SO + items
      const locked = await tx.$queryRaw<Array<{ id: string; status: string }>>`
        SELECT "id", "status" FROM "SalesOrder" WHERE "id" = ${id} FOR UPDATE
      `;
      const row = locked[0];
      if (!row) {
        throw new NotFoundError("Đơn bán", id);
      }

      // 2. Validate state machine
      assertTransition(SALES_ORDER_TRANSITIONS, row.status as $Enums.OrderStatus, "CANCELLED" as $Enums.OrderStatus, "SalesOrder");

      // Lấy SO đầy đủ items
      const so = await tx.salesOrder.findUniqueOrThrow({
        where: { id },
        include: { items: true },
      });

      // 3. WAREHOUSE + DELIVERED → hoàn kho
      if (so.fulfillmentType === "WAREHOUSE" && row.status === "DELIVERED") {
        for (const item of so.items) {
          if (!item.productId || !so.warehouseId) continue;
          await InventoryService.recordMovement(tx, {
            type: "IN",
            reason: MOVEMENT_REASON.CANCEL_SALE,
            productId: item.productId,
            warehouseId: so.warehouseId,
            quantity: item.qty,
            unitCost: item.baseCost.toString(),
            referenceType: REFERENCE_TYPE.SALES_ORDER,
            referenceId: so.id,
          });
        }
      }

      // 4. DROPSHIP — xử lý PO liên kết
      if (so.fulfillmentType === "DROPSHIP" && so.linkedPurchaseOrderId) {
        await CancelOrderService.cancelLinkedPurchaseOrder(
          tx,
          so.linkedPurchaseOrderId,
          so,
          meta,
        );
      }

      // 5. Ghi history + update status
      await tx.orderStatusHistory.create({
        data: {
          referenceType: REFERENCE_TYPE.SALES_ORDER,
          referenceId: id,
          fromStatus: row.status,
          toStatus: "CANCELLED",
          userId: meta.userId ?? null,
          note: meta.note ?? "Hủy đơn",
        },
      });

      return tx.salesOrder.update({
        where: { id },
        data: {
          status: "CANCELLED",
          cancelledDate: new Date(),
        },
      });
    });
  }

  /**
   * Hủy PO liên kết với SO dropship.
   * - PO chưa RECEIVED → chỉ đổi status.
   * - PO đã RECEIVED → hoàn kho (OUT) + đổi status.
   */
  private static async cancelLinkedPurchaseOrder(
    tx: TxClient,
    poId: string,
    so: SalesOrder & { items: Array<{ productId: string | null; qty: number; baseCost: import("@prisma/client").Prisma.Decimal }> },
    meta: CancelOrderMeta,
  ): Promise<PurchaseOrder> {
    // Lock PO
    const lockedPo = await tx.$queryRaw<Array<{ id: string; status: string }>>`
      SELECT "id", "status" FROM "PurchaseOrder" WHERE "id" = ${poId} FOR UPDATE
    `;
    const poRow = lockedPo[0];
    if (!poRow) {
      throw new NotFoundError("Đơn mua (dropship)", poId);
    }

    // PO đã CANCELLED → skip
    if (poRow.status === "CANCELLED") {
      return tx.purchaseOrder.findUniqueOrThrow({ where: { id: poId } });
    }

    // Validate transition
    assertTransition(PURCHASE_ORDER_TRANSITIONS, poRow.status as $Enums.PurchaseStatus, "CANCELLED" as $Enums.PurchaseStatus, "PurchaseOrder");

    // Lấy PO đầy đủ items
    const po = await tx.purchaseOrder.findUniqueOrThrow({
      where: { id: poId },
      include: { items: true },
    });

    // SO đã DELIVERED → hoàn kho DROPSHIP_OUT ngược (IN) cho SO items
    if (so.status !== "PENDING") {
      for (const item of so.items) {
        if (!item.productId || !po.warehouseId) continue;
        await InventoryService.recordMovement(tx, {
          type: "IN",
          reason: MOVEMENT_REASON.CANCEL_SALE,
          productId: item.productId,
          warehouseId: po.warehouseId,
          quantity: item.qty,
          unitCost: item.baseCost.toString(),
          referenceType: REFERENCE_TYPE.SALES_ORDER,
          referenceId: so.id,
        });
      }
    }

    // PO đã RECEIVED → hoàn kho ngược (OUT) trả NCC
    if (poRow.status === "RECEIVED") {
      for (const item of po.items) {
        if (!item.productId || !po.warehouseId) continue;
        await InventoryService.recordMovement(tx, {
          type: "OUT",
          reason: MOVEMENT_REASON.CANCEL_PURCHASE,
          productId: item.productId,
          warehouseId: po.warehouseId,
          quantity: item.qty,
          unitCost: item.buyPrice.toString(),
          referenceType: REFERENCE_TYPE.PURCHASE_ORDER,
          referenceId: poId,
        });
      }
    }

    // Ghi history PO + update status
    await tx.orderStatusHistory.create({
      data: {
        referenceType: REFERENCE_TYPE.PURCHASE_ORDER,
        referenceId: poId,
        fromStatus: poRow.status,
        toStatus: "CANCELLED",
        userId: meta.userId ?? null,
        note: meta.note ?? "Hủy đơn (dropship)",
      },
    });

    return tx.purchaseOrder.update({
      where: { id: poId },
      data: {
        status: "CANCELLED",
        cancelledDate: new Date(),
      },
    });
  }
}
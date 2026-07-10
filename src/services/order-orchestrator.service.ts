import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { SalesOrderService } from "@/services/sales-order.service";
import { PurchaseOrderService } from "@/services/purchase-order.service";
import { InventoryService } from "@/services/inventory.service";
import { InvoiceService } from "@/services/invoice.service";
import {
  assertTransition,
  SALES_ORDER_TRANSITIONS,
  PURCHASE_ORDER_TRANSITIONS,
} from "@/domain/state-machine";
import {
  FULFILLMENT_TYPE,
  MOVEMENT_TYPE,
  MOVEMENT_REASON,
  REFERENCE_TYPE,
} from "@/domain/constants";
import { NotFoundError } from "@/domain/errors";
import type {
  CreateSalesOrderInput,
  CreateDropshipOrderInput,
} from "@/lib/validations/order";

/**
 * OrderOrchestrator (invariant C5) — tạo đơn ATOMIC trong 1 prisma.$transaction.
 *
 * - WAREHOUSE: tạo SO đơn thuần (PENDING). Chưa side-effect kho (xuất kho ở P2-3
 *   khi DELIVERED).
 * - DROPSHIP: trong CÙNG 1 transaction → tạo PO trước (ORDERED) → tạo SO link
 *   linkedPurchaseOrderId. Nếu bất kỳ bước nào lỗi → rollback nguyên vẹn cả hai
 *   (không để PO treo, không để SO không link).
 *
 * Lưu ý: side-effect kho/tiền khi giao hàng thuộc P2-3/P3, KHÔNG làm ở đây.
 */

export interface OrchestratorMeta {
  userId?: string;
  now?: Date;
  random?: number;
  note?: string;
}

export class OrderOrchestrator {
  /** Tạo đơn bán từ kho (WAREHOUSE). 1 transaction. */
  static async createWarehouseOrder(
    input: CreateSalesOrderInput,
    meta: OrchestratorMeta = {},
    prisma: PrismaClient = defaultPrisma,
  ) {
    // Ép đúng loại — không tin client tự khai DROPSHIP ở luồng này.
    const soInput: CreateSalesOrderInput = {
      ...input,
      fulfillmentType: FULFILLMENT_TYPE.WAREHOUSE,
    };
    return prisma.$transaction(async (tx) => {
      const so = await SalesOrderService.createInTx(tx, soInput, {
        userId: meta.userId,
        now: meta.now,
        random: meta.random,
      });
      // Tạo AR Invoice cho đơn bán (C3)
      await InvoiceService.createFromSalesOrder(tx, {
        id: so.id,
        customerId: so.customerId,
        totalAmount: so.totalAmount.toString(),
      }, meta);
      return so;
    });
  }

  /**
   * Tạo đơn dropship (C5): PO (ORDERED) + SO link, trong 1 transaction.
   * Trả về { salesOrder, purchaseOrder }.
   */
  static async createDropshipOrder(
    input: CreateDropshipOrderInput,
    meta: OrchestratorMeta = {},
    prisma: PrismaClient = defaultPrisma,
  ) {
    const now = meta.now ?? new Date();
    const random = meta.random ?? 0.5;

    return prisma.$transaction(async (tx) => {
      // 1) Tạo PO trước (ORDERED) từ items (giá nhập buyPrice).
      const purchaseOrder = await PurchaseOrderService.createInTx(
        tx,
        {
          supplierId: input.supplierId,
          items: input.items.map((it) => ({
            productId: it.productId,
            productName: it.productName,
            unit: it.unit,
            qty: it.qty,
            buyPrice: it.buyPrice,
            taxAmount: "0",
          })),
          orderDate: input.saleDate,
        },
        { userId: meta.userId, now, random },
      );

      // 2) Tạo SO link linkedPurchaseOrderId (cùng transaction → atomic).
      const salesOrder = await SalesOrderService.createInTx(
        tx,
        {
          customerId: input.customerId,
          fulfillmentType: FULFILLMENT_TYPE.DROPSHIP,
          salespersonId: input.salespersonId,
          saleDate: input.saleDate,
          items: input.items.map((it) => ({
            productId: it.productId,
            productName: it.productName,
            unit: it.unit,
            qty: it.qty,
            sellPrice: it.sellPrice,
            baseCost: it.baseCost,
            taxAmount: it.taxAmount,
          })),
        },
        {
          userId: meta.userId,
          now,
          random: (random + 0.001) % 1, // tránh trùng orderCode với PO cùng ms
          linkedPurchaseOrderId: purchaseOrder.id,
        },
      );

      // 3) Tạo Invoice: AP cho PO (phải trả NCC), AR cho SO (phải thu khách)
      await InvoiceService.createFromPurchaseOrder(tx, {
        id: purchaseOrder.id,
        supplierId: purchaseOrder.supplierId,
        totalAmount: purchaseOrder.totalAmount.toString(),
      }, meta);
      await InvoiceService.createFromSalesOrder(tx, {
        id: salesOrder.id,
        customerId: salesOrder.customerId,
        totalAmount: salesOrder.totalAmount.toString(),
      }, meta);

      return { salesOrder, purchaseOrder };
    });
  }

  /**
   * Giao hàng đơn bán (P2-3). Trong 1 transaction:
   * - updateStatus → DELIVERED (FOR UPDATE + validateTransition + history)
   * - WAREHOUSE: xuất kho từng dòng (recordMovement OUT, SALES_SHIPMENT)
   * - DROPSHIP: ghi movement ảo (recordVirtualMovement, warehouseId=null)
   *
   * Idempotent: recordMovement/recordVirtualMovement check unique
   * (referenceType, referenceId, reason) → gọi lại không double side-effect.
   * Bỏ qua dòng không có productId (hàng phi kho).
   */
  static async deliverSalesOrder(
    salesOrderId: string,
    meta: OrchestratorMeta = {},
    prisma: PrismaClient = defaultPrisma,
  ) {
    return prisma.$transaction(async (tx) => {
      // 1) Lock + đọc trạng thái hiện tại
      const locked = await tx.$queryRaw<
        Array<{ id: string; status: string; fulfillmentType: string; warehouseId: string | null }>
      >`SELECT "id","status","fulfillmentType","warehouseId" FROM "SalesOrder" WHERE "id"=${salesOrderId} FOR UPDATE`;
      const row = locked[0];
      if (!row) throw new NotFoundError("Đơn bán", salesOrderId);

      // Idempotent: nếu đã DELIVERED → chỉ return, không làm lại side-effect
      if (row.status === "DELIVERED") {
        return tx.salesOrder.findUniqueOrThrow({
          where: { id: salesOrderId },
          include: { items: true },
        });
      }

      // 2) Đổi trạng thái → DELIVERED (validate + history + update)
      await SalesOrderService.updateStatus(tx, salesOrderId, "DELIVERED", {
        userId: meta.userId,
        note: "Giao hàng",
      });

      // 3) Đọc items để biết cần xuất gì
      const order = await tx.salesOrder.findUniqueOrThrow({
        where: { id: salesOrderId },
        include: { items: true },
      });

      const isDropship = order.fulfillmentType === FULFILLMENT_TYPE.DROPSHIP;

      // 4) Ghi movement cho từng dòng
      for (const item of order.items) {
        if (!item.productId) continue; // bỏ qua hàng phi kho

        const moveInput = {
          type: MOVEMENT_TYPE.OUT,
          reason: MOVEMENT_REASON.SALES_SHIPMENT,
          productId: item.productId,
          warehouseId: order.warehouseId ?? "", // "" cho dropship (sẽ bị bỏ qua)
          quantity: item.qty,
          unitCost: item.baseCost.toString(),
          referenceType: REFERENCE_TYPE.SALES_ORDER,
          referenceId: `${salesOrderId}-${item.id}`, // mỗi dòng 1 movement
        };

        if (isDropship) {
          // Dropship: movement ảo, không đụng tồn kho
          await InventoryService.recordVirtualMovement(tx, {
            ...moveInput,
            reason: MOVEMENT_REASON.DROPSHIP_OUT,
          });
        } else {
          // Warehouse: xuất kho thật (FOR UPDATE + WAC)
          await InventoryService.recordMovement(tx, moveInput);
        }
      }

      if (isDropship && order.linkedPurchaseOrderId) {
        await receivePurchaseOrderInternal(tx, order.linkedPurchaseOrderId, meta);
      }

      return tx.salesOrder.findUniqueOrThrow({
        where: { id: salesOrderId },
        include: { items: true },
      });
    }, { maxWait: 15_000, timeout: 20_000 });
  }

  /**
   * Nhận hàng đơn mua (P2-3). Trong 1 transaction:
   * - updateStatus → RECEIVED (FOR UPDATE + validateTransition + history)
   * - Nhập kho từng dòng (recordMovement IN, PURCHASE_RECEIPT)
   *
   * Idempotent: recordMovement unique constraint. Bỏ qua dòng không productId.
   */
  static async receivePurchaseOrder(
    purchaseOrderId: string,
    meta: OrchestratorMeta = {},
    prisma: PrismaClient = defaultPrisma,
  ) {
    return prisma.$transaction(
      (tx) => receivePurchaseOrderInternal(tx, purchaseOrderId, meta),
      { maxWait: 15_000, timeout: 20_000 }
    );
  }

  /**
   * Hủy đơn bán (P2-4). Trong 1 transaction:
   * - Lock row (FOR UPDATE), validate transition → CANCELLED
   * - Nếu đang DELIVERED: hoàn kho (RETURN_IN warehouse / virtual dropship)
   * - Nếu DROPSHIP có PO liên kết: đồng bộ hủy PO (tránh PO treo — C5)
   * - Ghi history
   *
   * CHƯA hoàn tiền (P3-2 Invoice/Payment chưa build).
   */
  static async cancelSalesOrder(
    salesOrderId: string,
    meta: OrchestratorMeta = {},
    prisma: PrismaClient = defaultPrisma,
  ) {
    // Nới timeout cho huỷ dropship (nhiều recordMovement + huỷ PO nội bộ trong 1 tx).
    return prisma.$transaction(
      async (tx) => {
      // 1) Lock + read
      const locked = await tx.$queryRaw<
        Array<{ id: string; status: string; fulfillmentType: string; warehouseId: string | null; linkedPurchaseOrderId: string | null }>
      >`SELECT "id","status","fulfillmentType","warehouseId","linkedPurchaseOrderId" FROM "SalesOrder" WHERE "id"=${salesOrderId} FOR UPDATE`;
      const row = locked[0];
      if (!row) throw new NotFoundError("Đơn bán", salesOrderId);

      const oldStatus = row.status as "PENDING" | "DELIVERED" | "CANCELLED";
      assertTransition(SALES_ORDER_TRANSITIONS, oldStatus, "CANCELLED", "SalesOrder");

      const items = await tx.salesOrderItem.findMany({ where: { salesOrderId } });
      const isDropship = row.fulfillmentType === "DROPSHIP";

      // 2) Hoàn kho nếu đã DELIVERED
      if (oldStatus === "DELIVERED") {
        for (const item of items) {
          if (!item.productId) continue;

          const moveInput = {
            type: MOVEMENT_TYPE.IN,
            reason: MOVEMENT_REASON.RETURN_IN,
            productId: item.productId,
            warehouseId: row.warehouseId ?? "",
            quantity: item.qty,
            unitCost: item.baseCost.toString(),
            referenceType: REFERENCE_TYPE.SALES_ORDER,
            referenceId: `cancel-${salesOrderId}-${item.id}`, // prefix cancel để tránh trùng movement giao hàng
          };

          if (isDropship) {
            await InventoryService.recordVirtualMovement(tx, {
              ...moveInput,
              reason: MOVEMENT_REASON.RETURN_IN,
            });
          } else {
            await InventoryService.recordMovement(tx, moveInput);
          }
        }
      }

      // 3) Hủy Invoice (C3: công nợ về 0)
      const invoice = await tx.invoice.findUnique({ where: { salesOrderId } });
      if (invoice && invoice.status !== "CANCELLED") {
        await InvoiceService.cancel(tx, invoice.id);
      }

      // 4) Cập nhật status
      await tx.salesOrder.update({
        where: { id: salesOrderId },
        data: { status: "CANCELLED", deliveredDate: null },
      });
      await tx.orderStatusHistory.create({
        data: {
          referenceType: REFERENCE_TYPE.SALES_ORDER,
          referenceId: salesOrderId,
          fromStatus: oldStatus,
          toStatus: "CANCELLED",
          userId: meta.userId ?? null,
          note: meta.note ?? "Hủy đơn",
        },
      });

      // 5) Đồng bộ PO dropship (C5: không để PO treo)
      if (isDropship && row.linkedPurchaseOrderId) {
        await cancelPurchaseOrderInternal(tx, row.linkedPurchaseOrderId, meta);
      }

      return tx.salesOrder.findUniqueOrThrow({
        where: { id: salesOrderId },
        include: { items: true },
      });
    }, { maxWait: 15_000, timeout: 30_000 });
  }

  /** Hủy đơn mua (P2-4). Hoàn kho nếu đã RECEIVED. */
  static async cancelPurchaseOrder(
    purchaseOrderId: string,
    meta: OrchestratorMeta = {},
    prisma: PrismaClient = defaultPrisma,
  ) {
    return prisma.$transaction(
      (tx) => cancelPurchaseOrderInternal(tx, purchaseOrderId, meta),
      { maxWait: 15_000, timeout: 20_000 },
    );
  }
}

/** Internal: hủy PO trong 1 tx có sẵn (dùng cho cả hủy độc lập và hủy đồng bộ SO dropship). */
async function cancelPurchaseOrderInternal(
  tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0],
  purchaseOrderId: string,
  meta: OrchestratorMeta,
) {
  const locked = await tx.$queryRaw<
    Array<{ id: string; status: string; warehouseId: string | null }>
  >`SELECT "id","status","warehouseId" FROM "PurchaseOrder" WHERE "id"=${purchaseOrderId} FOR UPDATE`;
  const row = locked[0];
  if (!row) throw new NotFoundError("Đơn mua", purchaseOrderId);

  const oldStatus = row.status as "ORDERED" | "RECEIVED" | "CANCELLED";

  // Nếu đã CANCELLED → idempotent, không làm lại
  if (oldStatus === "CANCELLED") {
    return tx.purchaseOrder.findUniqueOrThrow({
      where: { id: purchaseOrderId },
      include: { items: true },
    });
  }

  assertTransition(PURCHASE_ORDER_TRANSITIONS, oldStatus, "CANCELLED", "PurchaseOrder");

  const items = await tx.purchaseOrderItem.findMany({ where: { purchaseOrderId } });

  // Hoàn kho nếu đã RECEIVED
  if (oldStatus === "RECEIVED" && row.warehouseId) {
    for (const item of items) {
      if (!item.productId) continue;

      await InventoryService.recordMovement(tx, {
        type: MOVEMENT_TYPE.OUT,
        reason: MOVEMENT_REASON.RETURN_OUT,
        productId: item.productId,
        warehouseId: row.warehouseId,
        quantity: item.qty,
        unitCost: item.buyPrice.toString(),
        referenceType: REFERENCE_TYPE.PURCHASE_ORDER,
        referenceId: `cancel-${purchaseOrderId}-${item.id}`,
      });
    }
  }

  // Hủy Invoice AP nếu có
  const invoice = await tx.invoice.findUnique({ where: { purchaseOrderId } });
  if (invoice && invoice.status !== "CANCELLED") {
    await InvoiceService.cancel(tx, invoice.id);
  }

  await tx.purchaseOrder.update({
    where: { id: purchaseOrderId },
    data: { status: "CANCELLED", receivedDate: null },
  });
  await tx.orderStatusHistory.create({
    data: {
      referenceType: REFERENCE_TYPE.PURCHASE_ORDER,
      referenceId: purchaseOrderId,
      fromStatus: oldStatus,
      toStatus: "CANCELLED",
      userId: meta.userId ?? null,
      note: meta.note ?? "Hủy đơn",
    },
  });

  return tx.purchaseOrder.findUniqueOrThrow({
    where: { id: purchaseOrderId },
    include: { items: true },
  });
}

/** Internal: nhận hàng PO trong 1 tx có sẵn (dùng cho cả nhận độc lập và nhận đồng bộ SO dropship). */
async function receivePurchaseOrderInternal(
  tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0],
  purchaseOrderId: string,
  meta: OrchestratorMeta,
) {
  // 1) Lock + đọc trạng thái — idempotent nếu đã RECEIVED
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

  // 2) Đổi trạng thái → RECEIVED
  await PurchaseOrderService.updateStatus(tx, purchaseOrderId, "RECEIVED", {
    userId: meta.userId,
    note: "Nhận hàng",
  });

  // 3) Đọc items
  const order = await tx.purchaseOrder.findUniqueOrThrow({
    where: { id: purchaseOrderId },
    include: { items: true },
  });

  // 4) Nhập kho từng dòng
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

  return tx.purchaseOrder.findUniqueOrThrow({
    where: { id: purchaseOrderId },
    include: { items: true },
  });
}

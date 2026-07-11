import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { SalesOrderService } from "@/services/sales-order.service";
import { PurchaseOrderService } from "@/services/purchase-order.service";
import { OrderFulfillmentService, receivePurchaseOrderInternal } from "@/services/order-fulfillment.service";
import { OrderBillingService } from "@/services/order-billing.service";
import {
  assertTransition,
  SALES_ORDER_TRANSITIONS,
  PURCHASE_ORDER_TRANSITIONS,
} from "@/domain/state-machine";
import {
  FULFILLMENT_TYPE,
  REFERENCE_TYPE,
} from "@/domain/constants";
import { NotFoundError } from "@/domain/errors";
import type {
  CreateSalesOrderInput,
  CreateDropshipOrderInput,
} from "@/lib/validations/order";

/**
 * OrderOrchestrator (invariant C5) — ĐIỀU PHỐI (không chứa logic fulfillment/billing).
 *
 * Logic fulfillment → OrderFulfillmentService
 * Logic billing → OrderBillingService
 */

export interface OrchestratorMeta {
  userId?: string;
  now?: Date;
  random?: number;
  note?: string;
}

export class OrderOrchestrator {

  // ===== CREATE =====

  static async createWarehouseOrder(
    input: CreateSalesOrderInput,
    meta: OrchestratorMeta = {},
    prisma: PrismaClient = defaultPrisma,
  ) {
    const soInput: CreateSalesOrderInput = { ...input, fulfillmentType: FULFILLMENT_TYPE.WAREHOUSE };
    return prisma.$transaction(async (tx) => {
      const so = await SalesOrderService.createInTx(tx, soInput, { userId: meta.userId, now: meta.now, random: meta.random });
      await OrderBillingService.createSalesInvoice(tx, { id: so.id, customerId: so.customerId, totalAmount: so.totalAmount.toString() }, meta);
      return so;
    });
  }

  static async createDropshipOrder(
    input: CreateDropshipOrderInput,
    meta: OrchestratorMeta = {},
    prisma: PrismaClient = defaultPrisma,
  ) {
    const now = meta.now ?? new Date();
    const random = meta.random ?? 0.5;
    return prisma.$transaction(async (tx) => {
      const purchaseOrder = await PurchaseOrderService.createInTx(tx, {
        supplierId: input.supplierId,
        items: input.items.map((it) => ({ productId: it.productId, productName: it.productName, unit: it.unit, qty: it.qty, buyPrice: it.buyPrice, taxAmount: "0" })),
        orderDate: input.saleDate,
      }, { userId: meta.userId, now, random });

      const salesOrder = await SalesOrderService.createInTx(tx, {
        customerId: input.customerId, fulfillmentType: FULFILLMENT_TYPE.DROPSHIP,
        salespersonId: input.salespersonId, saleDate: input.saleDate,
        items: input.items.map((it) => ({ productId: it.productId, productName: it.productName, unit: it.unit, qty: it.qty, sellPrice: it.sellPrice, baseCost: it.baseCost, taxAmount: it.taxAmount })),
      }, { userId: meta.userId, now, random: (random + 0.001) % 1, linkedPurchaseOrderId: purchaseOrder.id });

      await OrderBillingService.createPurchaseInvoice(tx, { id: purchaseOrder.id, supplierId: purchaseOrder.supplierId, totalAmount: purchaseOrder.totalAmount.toString() }, meta);
      await OrderBillingService.createSalesInvoice(tx, { id: salesOrder.id, customerId: salesOrder.customerId, totalAmount: salesOrder.totalAmount.toString() }, meta);

      return { salesOrder, purchaseOrder };
    });
  }

  // ===== DELIVER / RECEIVE =====

  static async deliverSalesOrder(
    salesOrderId: string,
    meta: OrchestratorMeta = {},
    prisma: PrismaClient = defaultPrisma,
  ) {
    return prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<
        Array<{ id: string; status: string; fulfillmentType: string; warehouseId: string | null; linkedPurchaseOrderId: string | null }>
      >`SELECT "id","status","fulfillmentType","warehouseId","linkedPurchaseOrderId" FROM "SalesOrder" WHERE "id"=${salesOrderId} FOR UPDATE`;
      const row = locked[0];
      if (!row) throw new NotFoundError("Đơn bán", salesOrderId);

      if (row.status === "DELIVERED") {
        return tx.salesOrder.findUniqueOrThrow({ where: { id: salesOrderId }, include: { items: true } });
      }

      await SalesOrderService.updateStatus(tx, salesOrderId, "DELIVERED", { userId: meta.userId, note: "Giao hàng" });
      await OrderFulfillmentService.shipItems(tx, salesOrderId, { userId: meta.userId });

      if (row.fulfillmentType === "DROPSHIP" && row.linkedPurchaseOrderId) {
        await receivePurchaseOrderInternal(tx, row.linkedPurchaseOrderId, { userId: meta.userId });
      }

      return tx.salesOrder.findUniqueOrThrow({ where: { id: salesOrderId }, include: { items: true } });
    }, { maxWait: 15_000, timeout: 20_000 });
  }

  static async receivePurchaseOrder(
    purchaseOrderId: string,
    meta: OrchestratorMeta = {},
    prisma: PrismaClient = defaultPrisma,
  ) {
    return prisma.$transaction(
      (tx) => receivePurchaseOrderInternal(tx, purchaseOrderId, { userId: meta.userId }),
      { maxWait: 15_000, timeout: 20_000 }
    );
  }

  // ===== CANCEL =====

  static async cancelSalesOrder(
    salesOrderId: string,
    meta: OrchestratorMeta = {},
    prisma: PrismaClient = defaultPrisma,
  ) {
    return prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<
        Array<{ id: string; status: string; fulfillmentType: string; warehouseId: string | null; linkedPurchaseOrderId: string | null }>
      >`SELECT "id","status","fulfillmentType","warehouseId","linkedPurchaseOrderId" FROM "SalesOrder" WHERE "id"=${salesOrderId} FOR UPDATE`;
      const row = locked[0];
      if (!row) throw new NotFoundError("Đơn bán", salesOrderId);

      const oldStatus = row.status as "PENDING" | "DELIVERED" | "CANCELLED";
      assertTransition(SALES_ORDER_TRANSITIONS, oldStatus, "CANCELLED", "SalesOrder");

      if (oldStatus === "DELIVERED") {
        await OrderFulfillmentService.returnSalesItems(tx, salesOrderId, row.fulfillmentType, row.warehouseId, { userId: meta.userId });
      }

      await OrderBillingService.cancelSalesInvoice(tx, salesOrderId);

      await tx.salesOrder.update({ where: { id: salesOrderId }, data: { status: "CANCELLED", deliveredDate: null } });
      await tx.orderStatusHistory.create({ data: { referenceType: REFERENCE_TYPE.SALES_ORDER, referenceId: salesOrderId, fromStatus: oldStatus, toStatus: "CANCELLED", userId: meta.userId ?? null, note: meta.note ?? "Hủy đơn" } });

      if (row.fulfillmentType === "DROPSHIP" && row.linkedPurchaseOrderId) {
        await cancelPurchaseOrderInternal(tx, row.linkedPurchaseOrderId, meta);
      }

      return tx.salesOrder.findUniqueOrThrow({ where: { id: salesOrderId }, include: { items: true } });
    }, { maxWait: 15_000, timeout: 30_000 });
  }

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

// ===== Internal =====

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
  if (oldStatus === "CANCELLED") {
    return tx.purchaseOrder.findUniqueOrThrow({ where: { id: purchaseOrderId }, include: { items: true } });
  }

  assertTransition(PURCHASE_ORDER_TRANSITIONS, oldStatus, "CANCELLED", "PurchaseOrder");

  if (oldStatus === "RECEIVED" && row.warehouseId) {
    await OrderFulfillmentService.returnPurchaseItems(tx, purchaseOrderId, row.warehouseId, { userId: meta.userId });
  }

  await OrderBillingService.cancelPurchaseInvoice(tx, purchaseOrderId);

  await tx.purchaseOrder.update({ where: { id: purchaseOrderId }, data: { status: "CANCELLED", receivedDate: null } });
  await tx.orderStatusHistory.create({ data: { referenceType: REFERENCE_TYPE.PURCHASE_ORDER, referenceId: purchaseOrderId, fromStatus: oldStatus, toStatus: "CANCELLED", userId: meta.userId ?? null, note: meta.note ?? "Hủy đơn" } });

  return tx.purchaseOrder.findUniqueOrThrow({ where: { id: purchaseOrderId }, include: { items: true } });
}

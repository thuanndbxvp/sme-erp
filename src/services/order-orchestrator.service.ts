import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { SalesOrderService } from "@/services/sales-order.service";
import { PurchaseOrderService } from "@/services/purchase-order.service";
import { OrderFulfillmentService, receivePurchaseOrderInternal } from "@/services/order-fulfillment.service";
import { OrderBillingService } from "@/services/order-billing.service";
import { InventoryService } from "@/services/inventory.service";
import { TransactionService } from "@/services/transaction.service";
import { AuditAndSecurityHelper } from "@/lib/audit";
import { Money } from "@/domain/money";
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
  TRANSACTION_TYPE,
} from "@/domain/constants";
import { ConflictError, NotFoundError, ValidationError } from "@/domain/errors";
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
  /** Account dùng để hoàn tiền dư khi balanceDue < 0 sau khi giảm totalAmount. */
  refundAccountId?: string;
}

export interface UpdateSalesOrderInput {
  items: Array<{
    productId?: string | null;
    productName: string;
    unit: string;
    qty: number;
    sellPrice: string;
    baseCost: string;
    taxAmount?: string;
  }>;
}

export interface UpdatePurchaseOrderInput {
  items: Array<{
    productId?: string | null;
    productName: string;
    unit: string;
    qty: number;
    buyPrice: string;
    taxAmount?: string;
  }>;
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
        items: input.items.map((it) => ({ productId: it.productId, productName: it.productName, unit: it.unit, qty: it.qty, buyPrice: (it as { buyPrice?: string }).buyPrice || "0", taxAmount: (it as { purchaseTaxAmount?: string }).purchaseTaxAmount ?? "0" })),
        orderDate: input.saleDate,
      }, { userId: meta.userId, now, random });

      const salesOrder = await SalesOrderService.createInTx(tx, {
        customerId: input.customerId, fulfillmentType: FULFILLMENT_TYPE.DROPSHIP,
        salespersonId: input.salespersonId, saleDate: input.saleDate,
        commissionAmount: input.commissionAmount ?? "0",
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

  // ===== UPDATE (Lean — Auto-Delta kho + quỹ) =====

  /**
   * Sửa đơn bán với cơ chế Auto-Delta (MSEW lean-order-management).
   * - Chỉ áp dụng cho đơn PENDING (chưa giao) để tránh phá vỡ movement kho đã chốt.
   * - Tính deltaQty = newQty - oldQty theo từng productId:
   *   + delta > 0 (xuất thêm)  → InventoryService.recordMovement OUT (SALES_SHIPMENT) hoặc recordVirtualMovement (DROPSHIP)
   *   + delta < 0 (giảm bớt)  → recordMovement IN  (RETURN_IN) hoặc recordVirtualMovement (DROPSHIP)
   * - Cập nhật Invoice.totalAmount/balanceDue theo deltaAmount; nếu balanceDue < 0
   *   (khách đã trả dư) → sinh Transaction EXPENSE để hoàn lại quỹ và ép balanceDue = 0.
   * - Idempotent kho: referenceId = `${orderId}-${productId}` cho movement delta —
   *   mỗi (order, sp) chỉ tồn tại 1 movement delta, gọi lại nhiều lần không cộng dồn.
   */
  static async updateSalesOrder(
    salesOrderId: string,
    input: UpdateSalesOrderInput,
    meta: OrchestratorMeta = {},
    prisma: PrismaClient = defaultPrisma,
  ) {
    return prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<
        Array<{ id: string; status: string; fulfillmentType: string; warehouseId: string | null; totalAmount: string; customerId: string }>
      >`SELECT "id","status","fulfillmentType","warehouseId","totalAmount","customerId" FROM "SalesOrder" WHERE "id"=${salesOrderId} FOR UPDATE`;
      const oldOrder = locked[0];
      if (!oldOrder) throw new NotFoundError("Đơn bán", salesOrderId);
      if (oldOrder.status !== "PENDING") {
        throw new ConflictError(`Chỉ được sửa đơn bán đang ở trạng thái PENDING (hiện tại: ${oldOrder.status}).`);
      }

      const oldItems = await tx.salesOrderItem.findMany({ where: { salesOrderId } });
      const oldByProduct = new Map<string, { qty: number; productId: string; productName: string; unit: string; sellPrice: string; baseCost: string; taxAmount: string }>();
      for (const it of oldItems) {
        if (it.productId) oldByProduct.set(it.productId, { qty: it.qty, productId: it.productId, productName: it.productName, unit: it.unit, sellPrice: it.sellPrice.toString(), baseCost: it.baseCost.toString(), taxAmount: it.taxAmount.toString() });
      }
      const newByProduct = new Map<string, UpdateSalesOrderInput["items"][number]>();
      for (const it of input.items) {
        if (!it.productId) continue;
        newByProduct.set(it.productId, it);
      }

      let subtotal = Money.zero();
      let taxTotal = Money.zero();
      const newItemsPayload: Array<{ productId: string | null; productName: string; unit: string; qty: number; sellPrice: string; sellTotal: string; baseCost: string; taxAmount: string }> = [];
      for (const it of input.items) {
        const sellTotal = Money.of(it.sellPrice).mul(it.qty);
        const tax = Money.of(it.taxAmount ?? "0");
        subtotal = subtotal.add(sellTotal);
        taxTotal = taxTotal.add(tax);
        newItemsPayload.push({
          productId: it.productId ?? null,
          productName: it.productName,
          unit: it.unit,
          qty: it.qty,
          sellPrice: Money.of(it.sellPrice).toDecimalString(),
          sellTotal: sellTotal.toDecimalString(),
          baseCost: Money.of(it.baseCost).toDecimalString(),
          taxAmount: tax.toDecimalString(),
        });
      }
      const newTotalAmount = subtotal.add(taxTotal);
      const oldTotalAmount = Money.of(oldOrder.totalAmount.toString());
      const deltaAmount = newTotalAmount.sub(oldTotalAmount);

      await tx.salesOrderItem.deleteMany({ where: { salesOrderId } });
      await tx.salesOrderItem.createMany({
        data: newItemsPayload.map((it) => ({ ...it, salesOrderId })),
      });

      await tx.salesOrder.update({
        where: { id: salesOrderId },
        data: { totalAmount: newTotalAmount.toDecimalString(), taxAmount: taxTotal.toDecimalString() },
      });

      const isDropship = oldOrder.fulfillmentType === FULFILLMENT_TYPE.DROPSHIP;
      const productIds = new Set<string>([...oldByProduct.keys(), ...newByProduct.keys()]);
      for (const productId of productIds) {
        const oldQty = oldByProduct.get(productId)?.qty ?? 0;
        const newQty = newByProduct.get(productId)?.qty ?? 0;
        const deltaQty = newQty - oldQty;
        if (deltaQty === 0) continue;
        const baseUnitCost = Money.of(newByProduct.get(productId)?.baseCost ?? oldByProduct.get(productId)?.baseCost ?? "0").toDecimalString();

        if (deltaQty > 0) {
          if (isDropship) {
            await InventoryService.recordVirtualMovement(tx, {
              type: MOVEMENT_TYPE.OUT,
              reason: MOVEMENT_REASON.DROPSHIP_OUT,
              productId,
              warehouseId: oldOrder.warehouseId ?? "",
              quantity: deltaQty,
              unitCost: baseUnitCost,
              referenceType: REFERENCE_TYPE.SALES_ORDER,
              referenceId: `${salesOrderId}-${productId}`,
            });
          } else {
            if (!oldOrder.warehouseId) throw new ValidationError("Đơn bán WAREHOUSE phải có warehouseId để ghi movement kho.");
            await InventoryService.recordMovement(tx, {
              type: MOVEMENT_TYPE.OUT,
              reason: MOVEMENT_REASON.SALES_SHIPMENT,
              productId,
              warehouseId: oldOrder.warehouseId,
              quantity: deltaQty,
              unitCost: baseUnitCost,
              referenceType: REFERENCE_TYPE.SALES_ORDER,
              referenceId: `${salesOrderId}-${productId}`,
            });
          }
        } else {
          if (isDropship) {
            await InventoryService.recordVirtualMovement(tx, {
              type: MOVEMENT_TYPE.IN,
              reason: MOVEMENT_REASON.RETURN_IN,
              productId,
              warehouseId: oldOrder.warehouseId ?? "",
              quantity: -deltaQty,
              unitCost: baseUnitCost,
              referenceType: REFERENCE_TYPE.SALES_ORDER,
              referenceId: `${salesOrderId}-${productId}`,
            });
          } else {
            if (!oldOrder.warehouseId) throw new ValidationError("Đơn bán WAREHOUSE phải có warehouseId để ghi movement kho.");
            await InventoryService.recordMovement(tx, {
              type: MOVEMENT_TYPE.IN,
              reason: MOVEMENT_REASON.RETURN_IN,
              productId,
              warehouseId: oldOrder.warehouseId,
              quantity: -deltaQty,
              unitCost: baseUnitCost,
              referenceType: REFERENCE_TYPE.SALES_ORDER,
              referenceId: `${salesOrderId}-${productId}`,
            });
          }
        }
      }

      const invoice = await tx.invoice.findUnique({ where: { salesOrderId } });
      if (invoice) {
        const newInvoiceTotal = Money.of(invoice.totalAmount.toString()).add(deltaAmount);
        const oldBalanceDue = Money.of(invoice.balanceDue.toString());
        const newBalanceDueRaw = oldBalanceDue.add(deltaAmount);
        if (newBalanceDueRaw.isNegative()) {
          if (!meta.refundAccountId) {
            throw new ValidationError("balanceDue bị âm sau khi giảm tổng tiền — cần truyền refundAccountId để hoàn tiền cho khách.");
          }
          const refundAmount = newBalanceDueRaw.abs();
          await TransactionService.recordTransaction(tx, {
            type: TRANSACTION_TYPE.EXPENSE,
            amount: refundAmount.toDecimalString(),
            accountId: meta.refundAccountId,
            cashFlowGroup: "OPERATIONAL",
            customerId: invoice.customerId,
            salesOrderId,
            description: `Hoàn tiền dư do sửa đơn bán (${invoice.invoiceNumber})`,
          });
          await tx.invoice.update({
            where: { id: invoice.id },
            data: {
              totalAmount: newInvoiceTotal.toDecimalString(),
              balanceDue: Money.zero().toDecimalString(),
            },
          });
        } else {
          await tx.invoice.update({
            where: { id: invoice.id },
            data: {
              totalAmount: newInvoiceTotal.toDecimalString(),
              balanceDue: newBalanceDueRaw.toDecimalString(),
              status: newBalanceDueRaw.isZero() ? "PAID" : invoice.status,
            },
          });
        }
      }

      AuditAndSecurityHelper.logAction({
        action: "UPDATE",
        entityType: "SalesOrder",
        entityId: salesOrderId,
        userId: meta.userId,
        metadata: { message: "Sửa đơn hàng Auto-Delta", deltaAmount: deltaAmount.toDecimalString() },
      });

      return tx.salesOrder.findUniqueOrThrow({ where: { id: salesOrderId }, include: { items: true } });
    }, { maxWait: 15_000, timeout: 30_000 });
  }

  /**
   * Sửa đơn mua với cơ chế Auto-Delta (đối xứng với updateSalesOrder).
   * - Chỉ áp dụng cho đơn ORDERED (chưa nhập kho).
   * - deltaQty > 0 (mua thêm) → IN / PURCHASE_RECEIPT
   * - deltaQty < 0 (giảm)     → OUT / RETURN_OUT
   */
  static async updatePurchaseOrder(
    purchaseOrderId: string,
    input: UpdatePurchaseOrderInput,
    meta: OrchestratorMeta = {},
    prisma: PrismaClient = defaultPrisma,
  ) {
    return prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<
        Array<{ id: string; status: string; warehouseId: string | null; totalAmount: string; supplierId: string }>
      >`SELECT "id","status","warehouseId","totalAmount","supplierId" FROM "PurchaseOrder" WHERE "id"=${purchaseOrderId} FOR UPDATE`;
      const oldOrder = locked[0];
      if (!oldOrder) throw new NotFoundError("Đơn mua", purchaseOrderId);
      if (oldOrder.status !== "ORDERED") {
        throw new ConflictError(`Chỉ được sửa đơn mua đang ở trạng thái ORDERED (hiện tại: ${oldOrder.status}).`);
      }

      const oldItems = await tx.purchaseOrderItem.findMany({ where: { purchaseOrderId } });
      const oldByProduct = new Map<string, { qty: number; productId: string; productName: string; unit: string; buyPrice: string; taxAmount: string }>();
      for (const it of oldItems) {
        if (it.productId) oldByProduct.set(it.productId, { qty: it.qty, productId: it.productId, productName: it.productName, unit: it.unit, buyPrice: it.buyPrice.toString(), taxAmount: it.taxAmount.toString() });
      }
      const newByProduct = new Map<string, UpdatePurchaseOrderInput["items"][number]>();
      for (const it of input.items) {
        if (!it.productId) continue;
        newByProduct.set(it.productId, it);
      }

      let subtotal = Money.zero();
      let taxTotal = Money.zero();
      const newItemsPayload: Array<{ productId: string | null; productName: string; unit: string; qty: number; buyPrice: string; buyTotal: string; taxAmount: string }> = [];
      for (const it of input.items) {
        const buyTotal = Money.of(it.buyPrice).mul(it.qty);
        const tax = Money.of(it.taxAmount ?? "0");
        subtotal = subtotal.add(buyTotal);
        taxTotal = taxTotal.add(tax);
        newItemsPayload.push({
          productId: it.productId ?? null,
          productName: it.productName,
          unit: it.unit,
          qty: it.qty,
          buyPrice: Money.of(it.buyPrice).toDecimalString(),
          buyTotal: buyTotal.toDecimalString(),
          taxAmount: tax.toDecimalString(),
        });
      }
      const newTotalAmount = subtotal.add(taxTotal);
      const oldTotalAmount = Money.of(oldOrder.totalAmount.toString());
      const deltaAmount = newTotalAmount.sub(oldTotalAmount);

      await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId } });
      await tx.purchaseOrderItem.createMany({
        data: newItemsPayload.map((it) => ({ ...it, purchaseOrderId })),
      });

      await tx.purchaseOrder.update({
        where: { id: purchaseOrderId },
        data: { totalAmount: newTotalAmount.toDecimalString(), taxAmount: taxTotal.toDecimalString() },
      });

      const productIds = new Set<string>([...oldByProduct.keys(), ...newByProduct.keys()]);
      for (const productId of productIds) {
        const oldQty = oldByProduct.get(productId)?.qty ?? 0;
        const newQty = newByProduct.get(productId)?.qty ?? 0;
        const deltaQty = newQty - oldQty;
        if (deltaQty === 0) continue;
        const buyUnitCost = Money.of(newByProduct.get(productId)?.buyPrice ?? oldByProduct.get(productId)?.buyPrice ?? "0").toDecimalString();

        if (deltaQty > 0) {
          // Mua thêm: nhập kho IN / PURCHASE_RECEIPT
          if (!oldOrder.warehouseId) throw new ValidationError("Đơn mua phải có warehouseId để ghi movement kho.");
          await InventoryService.recordMovement(tx, {
            type: MOVEMENT_TYPE.IN,
            reason: MOVEMENT_REASON.PURCHASE_RECEIPT,
            productId,
            warehouseId: oldOrder.warehouseId,
            quantity: deltaQty,
            unitCost: buyUnitCost,
            referenceType: REFERENCE_TYPE.PURCHASE_ORDER,
            referenceId: `${purchaseOrderId}-${productId}`,
          });
        } else {
          // Giảm bớt: xuất kho OUT / RETURN_OUT (trả NCC)
          if (!oldOrder.warehouseId) throw new ValidationError("Đơn mua phải có warehouseId để ghi movement kho.");
          await InventoryService.recordMovement(tx, {
            type: MOVEMENT_TYPE.OUT,
            reason: MOVEMENT_REASON.RETURN_OUT,
            productId,
            warehouseId: oldOrder.warehouseId,
            quantity: -deltaQty,
            unitCost: buyUnitCost,
            referenceType: REFERENCE_TYPE.PURCHASE_ORDER,
            referenceId: `${purchaseOrderId}-${productId}`,
          });
        }
      }

      const invoice = await tx.invoice.findUnique({ where: { purchaseOrderId } });
      if (invoice) {
        const newInvoiceTotal = Money.of(invoice.totalAmount.toString()).add(deltaAmount);
        const oldBalanceDue = Money.of(invoice.balanceDue.toString());
        const newBalanceDueRaw = oldBalanceDue.add(deltaAmount);
        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            totalAmount: newInvoiceTotal.toDecimalString(),
            balanceDue: newBalanceDueRaw.isNegative() ? Money.zero().toDecimalString() : newBalanceDueRaw.toDecimalString(),
            status: newBalanceDueRaw.isNegative() ? "PAID" : (newBalanceDueRaw.isZero() ? "PAID" : invoice.status),
          },
        });
      }

      AuditAndSecurityHelper.logAction({
        action: "UPDATE",
        entityType: "PurchaseOrder",
        entityId: purchaseOrderId,
        userId: meta.userId,
        metadata: { message: "Sửa đơn mua Auto-Delta", deltaAmount: deltaAmount.toDecimalString() },
      });

      return tx.purchaseOrder.findUniqueOrThrow({ where: { id: purchaseOrderId }, include: { items: true } });
    }, { maxWait: 15_000, timeout: 30_000 });
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

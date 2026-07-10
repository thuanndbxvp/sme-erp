/**
 * Integration test hủy đơn (P2-4, invariant C3/C4/C5) — DB THẬT (Neon).
 *
 * AC:
 * - WAREHOUSE PENDING → CANCELLED: chỉ đổi status, không chạm kho.
 * - WAREHOUSE DELIVERED → CANCELLED: hoàn kho (IN), status CANCELLED.
 * - DROPSHIP PENDING → CANCELLED: SO + PO đều CANCELLED (không inventory).
 * - DROPSHIP DELIVERED + PO RECEIVED: hoàn kho cả 2 (CANCEL_SALE + CANCEL_PURCHASE).
 * - Cancel sai transition (đã CANCELLED) → throw.
 * - Cancel đơn không tồn tại → NotFoundError.
 * Tự skip nếu không có DATABASE_URL.
 */
import { config } from "dotenv";
config();

import { PrismaClient, type Product } from "@prisma/client";
import { OrderOrchestrator } from "@/services/order-orchestrator.service";
import { SalesOrderService } from "@/services/sales-order.service";
import { PurchaseOrderService } from "@/services/purchase-order.service";
import { InventoryService } from "@/services/inventory.service";
import { CancelOrderService } from "@/services/cancel-order.service";
import { NotFoundError } from "@/domain/errors";
import { MOVEMENT_REASON, REFERENCE_TYPE } from "@/domain/constants";

const hasDb = !!process.env.DATABASE_URL;
const describeIf = hasDb ? describe : describe.skip;
jest.setTimeout(90_000);

const prisma = new PrismaClient();
const TAG = "__cancel_it__";
const TAG_PROD = "__cancel_prod__";

let customerId: string;
let supplierId: string;
let warehouseId: string;
let product: Product;

async function cleanup() {
  // 1. Find all orders by tag to know their IDs
  const soIds = (
    await prisma.salesOrder.findMany({
      where: { customer: { name: { contains: TAG } } },
      select: { id: true },
    })
  ).map((r) => r.id);
  const poIds = (
    await prisma.purchaseOrder.findMany({
      where: { supplier: { name: { contains: TAG } } },
      select: { id: true },
    })
  ).map((r) => r.id);

  // 2. Delete dependent records by order IDs or product tag
  const refIds = [...soIds, ...poIds];
  if (refIds.length > 0) {
    await prisma.inventoryMovement.deleteMany({ where: { referenceId: { in: refIds } } });
    await prisma.orderStatusHistory.deleteMany({ where: { referenceId: { in: refIds } } });
    await prisma.salesOrderItem.deleteMany({ where: { salesOrderId: { in: soIds } } });
    await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: { in: poIds } } });
  }

  // 3. Delete inventory movements & items by product tag
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prodTagFilter: any = { product: { name: { contains: TAG_PROD } } };
  await prisma.inventoryMovement.deleteMany({ where: prodTagFilter });
  await prisma.salesOrderItem.deleteMany({ where: prodTagFilter });
  await prisma.purchaseOrderItem.deleteMany({ where: prodTagFilter });
  await prisma.warehouseInventory.deleteMany({ where: prodTagFilter });

  // 4. Delete orders
  if (soIds.length > 0) await prisma.salesOrder.deleteMany({ where: { id: { in: soIds } } });
  if (poIds.length > 0) await prisma.purchaseOrder.deleteMany({ where: { id: { in: poIds } } });

  // 5. Delete master data tags
  await prisma.customer.deleteMany({ where: { name: { contains: TAG } } });
  await prisma.supplier.deleteMany({ where: { name: { contains: TAG } } });
  await prisma.product.deleteMany({ where: { name: { contains: TAG_PROD } } });
  await prisma.warehouse.deleteMany({ where: { code: { contains: TAG } } });
}

let rnd = 0.7;
function nextRandom() {
  rnd = (rnd + 0.037) % 1;
  return rnd;
}

describeIf("CancelOrderService integration (P2-4)", () => {
  beforeAll(async () => {
    await cleanup();
    const c = await prisma.customer.create({ data: { name: `${TAG}-KH` } });
    const s = await prisma.supplier.create({ data: { name: `${TAG}-NCC` } });
    const w = await prisma.warehouse.create({ data: { code: `${TAG}-WH`, name: `${TAG} warehouse` } });
    const p = await prisma.product.create({
      data: {
        sku: `${TAG_PROD}-01`,
        name: `${TAG_PROD} A`,
        unit: "cái",
        buyPrice: "5000",
        sellPrice: "10000",
      },
    });
    customerId = c.id;
    supplierId = s.id;
    warehouseId = w.id;
    product = p;
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  // ===== WAREHOUSE =====

  it("WAREHOUSE PENDING → CANCELLED: chỉ đổi status, không chạm kho", async () => {
    // Tạo SO WAREHOUSE PENDING
    const so = await OrderOrchestrator.createWarehouseOrder(
      {
        customerId,
        fulfillmentType: "WAREHOUSE",
        items: [
          { productId: product.id, productName: product.name, unit: product.unit, qty: 3, sellPrice: "10000", baseCost: product.buyPrice.toString(), taxAmount: "0" },
        ],
      },
      { now: new Date(), random: nextRandom() },
      prisma,
    );
    expect(so.status).toBe("PENDING");

    // Đếm inventory movements trước
    const movBefore = await prisma.inventoryMovement.count({
      where: { referenceType: REFERENCE_TYPE.SALES_ORDER, referenceId: so.id },
    });

    // Cancel
    const cancelled = await CancelOrderService.cancelSalesOrder(so.id, { userId: "test-user" }, prisma);
    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.cancelledDate).toBeTruthy();

    // Không sinh movement
    const movAfter = await prisma.inventoryMovement.count({
      where: { referenceType: REFERENCE_TYPE.SALES_ORDER, referenceId: so.id },
    });
    expect(movAfter).toBe(movBefore);

    // History có dòng CANCELLED
    const history = await prisma.orderStatusHistory.findFirst({
      where: { referenceType: REFERENCE_TYPE.SALES_ORDER, referenceId: so.id, toStatus: "CANCELLED" },
    });
    expect(history).toBeTruthy();
  });

  it("WAREHOUSE DELIVERED → CANCELLED: hoàn kho (IN), status CANCELLED", async () => {
    // Tạo SO + items gắn product
    const so = await OrderOrchestrator.createWarehouseOrder(
      {
        customerId,
        fulfillmentType: "WAREHOUSE",
        items: [
          { productId: product.id, productName: product.name, unit: product.unit, qty: 2, sellPrice: "10000", baseCost: product.buyPrice.toString(), taxAmount: "0" },
        ],
        warehouseId,
      },
      { now: new Date(), random: nextRandom() },
      prisma,
    );

    // Thêm tồn kho trước khi deliver
    await prisma.$transaction((tx) =>
      InventoryService.recordMovement(tx, {
        type: "IN",
        reason: MOVEMENT_REASON.PURCHASE_RECEIPT,
        productId: product.id,
        warehouseId,
        quantity: 10,
        unitCost: product.buyPrice.toString(),
        referenceType: REFERENCE_TYPE.PURCHASE_ORDER,
        referenceId: "fake-po-" + so.id,
      }),
    );

    // Deliver SO (xuất kho SALES_SHIPMENT)
    await prisma.$transaction(async (tx) => {
      await SalesOrderService.updateStatus(tx, so.id, "DELIVERED");
      const soWithItems = await tx.salesOrder.findUniqueOrThrow({
        where: { id: so.id },
        include: { items: true },
      });
      for (const item of soWithItems.items) {
        await InventoryService.recordMovement(tx, {
          type: "OUT",
          reason: MOVEMENT_REASON.SALES_SHIPMENT,
          productId: product.id,
          warehouseId,
          quantity: item.qty,
          unitCost: item.baseCost.toString(),
          referenceType: REFERENCE_TYPE.SALES_ORDER,
          referenceId: so.id,
        });
      }
    });

    // Kiểm tra tồn trước cancel
    const invBefore = await prisma.warehouseInventory.findFirst({
      where: { warehouseId, productId: product.id },
    });
    const qtyBefore = invBefore?.quantity ?? 0;
    const cancelMovBefore = await prisma.inventoryMovement.count({
      where: { referenceType: REFERENCE_TYPE.SALES_ORDER, referenceId: so.id, reason: MOVEMENT_REASON.CANCEL_SALE },
    });

    // Cancel
    const cancelled = await CancelOrderService.cancelSalesOrder(so.id, { userId: "test-user" }, prisma);
    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.cancelledDate).toBeTruthy();

    // Kiểm tra tồn sau cancel: đã +2 (qty của items)
    const invAfter = await prisma.warehouseInventory.findFirst({
      where: { warehouseId, productId: product.id },
    });
    expect(invAfter!.quantity).toBe(qtyBefore + 2);

    // Có movement CANCEL_SALE — 1 item row → 1 movement (không phải per qty)
    const cancelMovAfter = await prisma.inventoryMovement.count({
      where: { referenceType: REFERENCE_TYPE.SALES_ORDER, referenceId: so.id, reason: MOVEMENT_REASON.CANCEL_SALE },
    });
    expect(cancelMovAfter).toBe(cancelMovBefore + 1);
  });

  // ===== DROPSHIP =====

  it("DROPSHIP PENDING → CANCELLED: SO + PO đều CANCELLED, không inventory", async () => {
    const { salesOrder, purchaseOrder } = await OrderOrchestrator.createDropshipOrder(
      {
        customerId,
        supplierId,
        items: [
          {
            productName: "DS-PENDING",
            unit: "cái",
            qty: 4,
            sellPrice: "15000",
            baseCost: "0",
            taxAmount: "0",
            buyPrice: "9000",
          },
        ],
      },
      { now: new Date(), random: nextRandom() },
      prisma,
    );
    expect(salesOrder.status).toBe("PENDING");
    expect(purchaseOrder.status).toBe("ORDERED");

    // Cancel SO
    const cancelled = await CancelOrderService.cancelSalesOrder(salesOrder.id, { userId: "test-user" }, prisma);
    expect(cancelled.status).toBe("CANCELLED");

    // PO cũng cancelled
    const poReloaded = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: purchaseOrder.id } });
    expect(poReloaded.status).toBe("CANCELLED");
    expect(poReloaded.cancelledDate).toBeTruthy();

    // Không inventory movement nào
    const movs = await prisma.inventoryMovement.count({
      where: { OR: [{ referenceType: REFERENCE_TYPE.SALES_ORDER, referenceId: salesOrder.id }, { referenceType: REFERENCE_TYPE.PURCHASE_ORDER, referenceId: purchaseOrder.id }] },
    });
    expect(movs).toBe(0);
  });

  it("DROPSHIP DELIVERED + PO RECEIVED: hoàn kho cả 2 chiều", async () => {
    // Tạo sản phẩm riêng cho test này
    const p = await prisma.product.create({
      data: { sku: `${TAG_PROD}-DS2`, name: `${TAG_PROD} DS2`, unit: "cái", buyPrice: "7000", sellPrice: "14000" },
    });

    // Tạo WAREHOUSE cho dropship (kho ảo dùng chung)
    const wh = await prisma.warehouse.create({ data: { code: `${TAG}-DSWH`, name: `${TAG} dropship wh` } });

    const { salesOrder, purchaseOrder } = await OrderOrchestrator.createDropshipOrder(
      {
        customerId,
        supplierId,
        items: [
          { productId: p.id, productName: p.name, unit: p.unit, qty: 5, sellPrice: "14000", baseCost: p.buyPrice.toString(), taxAmount: "0", buyPrice: p.buyPrice.toString() },
        ],
      },
      { now: new Date(), random: nextRandom() },
      prisma,
    );

    // Gán warehouse cho PO (kho ảo dropship) trước khi receiving
    await prisma.purchaseOrder.update({
      where: { id: purchaseOrder.id },
      data: { warehouseId: wh.id },
    });

    // Receiving PO (nhập kho PURCHASE_RECEIPT)
    await prisma.$transaction(async (tx) => {
      await PurchaseOrderService.updateStatus(tx, purchaseOrder.id, "RECEIVED");
      await InventoryService.recordMovement(tx, {
        type: "IN",
        reason: MOVEMENT_REASON.PURCHASE_RECEIPT,
        productId: p.id,
        warehouseId: wh.id,
        quantity: 5,
        unitCost: p.buyPrice.toString(),
        referenceType: REFERENCE_TYPE.PURCHASE_ORDER,
        referenceId: purchaseOrder.id,
      });
    });

    // Deliver SO (xuất dropship DROPSHIP_OUT) — dùng warehouse của PO
    await prisma.$transaction(async (tx) => {
      await SalesOrderService.updateStatus(tx, salesOrder.id, "DELIVERED");
      await InventoryService.recordMovement(tx, {
        type: "OUT",
        reason: MOVEMENT_REASON.DROPSHIP_OUT,
        productId: p.id,
        warehouseId: wh.id,
        quantity: 5,
        unitCost: p.buyPrice.toString(),
        referenceType: REFERENCE_TYPE.SALES_ORDER,
        referenceId: salesOrder.id,
      });
    });

    // Tồn trước cancel = 0 (vì nhập 5 xuất 5)
    const invBefore = await prisma.warehouseInventory.findFirst({
      where: { warehouseId: wh.id, productId: p.id },
    });
    expect(invBefore!.quantity).toBe(0);

    // Cancel SO
    const cancelled = await CancelOrderService.cancelSalesOrder(salesOrder.id, { userId: "test-user" }, prisma);
    expect(cancelled.status).toBe("CANCELLED");

    // PO cũng cancelled
    const poReloaded = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: purchaseOrder.id } });
    expect(poReloaded.status).toBe("CANCELLED");

    // Kiểm tra movement CANCEL_SALE (hoàn SO): IN 5
    const cancelSaleMovs = await prisma.inventoryMovement.findMany({
      where: { referenceType: REFERENCE_TYPE.SALES_ORDER, referenceId: salesOrder.id, reason: MOVEMENT_REASON.CANCEL_SALE },
    });
    expect(cancelSaleMovs.length).toBeGreaterThanOrEqual(1);

    // Kiểm tra movement CANCEL_PURCHASE (hoàn PO): OUT 5
    const cancelPurchMovs = await prisma.inventoryMovement.findMany({
      where: { referenceType: REFERENCE_TYPE.PURCHASE_ORDER, referenceId: purchaseOrder.id, reason: MOVEMENT_REASON.CANCEL_PURCHASE },
    });
    expect(cancelPurchMovs.length).toBeGreaterThanOrEqual(1);

    // Tồn sau cancel = 0 (vì nhập 5 → DROPSHIP_OUT 5 → CANCEL_SALE IN 5 → CANCEL_PURCHASE OUT 5)
    const invAfter = await prisma.warehouseInventory.findFirst({
      where: { warehouseId: wh.id, productId: p.id },
    });
    expect(invAfter!.quantity).toBe(0);
  });

  // ===== EDGE CASES =====

  it("Cancel sai transition (đã CANCELLED) → throw", async () => {
    const so = await SalesOrderService.create(
      {
        customerId,
        fulfillmentType: "WAREHOUSE",
        items: [{ productName: "EDGE", unit: "cái", qty: 1, sellPrice: "1000", baseCost: "500", taxAmount: "0" }],
      },
      { now: new Date(), random: nextRandom() },
      prisma,
    );
    await CancelOrderService.cancelSalesOrder(so.id, {}, prisma);
    await expect(CancelOrderService.cancelSalesOrder(so.id, {}, prisma)).rejects.toThrow();
  });

  it("Cancel đơn không tồn tại → NotFoundError", async () => {
    await expect(CancelOrderService.cancelSalesOrder("non-existent-id", {}, prisma)).rejects.toThrow(NotFoundError);
  });
});
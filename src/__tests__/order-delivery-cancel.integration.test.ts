/**
 * Integration test P2-3 (giao hÃ ng) + P2-4 (há»§y Ä‘Æ¡n) â€” DB THáº¬T (Neon).
 *
 * AC P2-3: tá»“n giáº£m Ä‘Ãºng khi giao WAREHOUSE; idempotent khi retry.
 * AC P2-4: há»§y má»—i loáº¡i; tá»“n vá» Ä‘Ãºng (hoÃ n kho).
 */
import { config } from "dotenv";
config();

import { PrismaClient } from "@prisma/client";
import { OrderOrchestrator } from "@/services/order-orchestrator.service";

const hasDb = !!process.env.DATABASE_URL;
const describeIf = hasDb ? describe : describe.skip;
jest.setTimeout(60_000);

const prisma = new PrismaClient();
const TAG = "__delcan__";

let customerId: string;
let supplierId: string;
let warehouseId: string;
let product1Id: string; // dÃ¹ng cho SO items
let product2Id: string;

async function cleanup() {
  // XÃ³a Ä‘Ãºng thá»© tá»± Ä‘á»ƒ trÃ¡nh FK RESTRICT: con trÆ°á»›c, cha sau.
  // 1. Movement (FKâ†’Product, unique constraint â†’ cáº§n xÃ³a sá»›m)
  await prisma.inventoryMovement.deleteMany({
    where: { product: { sku: { contains: TAG } } },
  });
  // 2. SO items â†’ SO â†’ Customer
  await prisma.salesOrderItem.deleteMany({ where: { salesOrder: { customer: { name: { contains: TAG } } } } });
  await prisma.salesOrder.deleteMany({ where: { customer: { name: { contains: TAG } } } });
  // 3. PO items â†’ PO â†’ Supplier
  await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrder: { supplier: { name: { contains: TAG } } } } });
  await prisma.purchaseOrder.deleteMany({ where: { supplier: { name: { contains: TAG } } } });
  // 4. History (khÃ´ng FK)
  await prisma.orderStatusHistory.deleteMany({ where: { referenceId: { contains: TAG } } });
  // 5. Inventory â†’ Product â†’ Warehouse
  await prisma.warehouseInventory.deleteMany({ where: { warehouse: { code: { contains: TAG } } } });
  await prisma.product.deleteMany({ where: { sku: { contains: TAG } } });
  // 6. Danh má»¥c cha
  await prisma.customer.deleteMany({ where: { name: { contains: TAG } } });
  await prisma.supplier.deleteMany({ where: { name: { contains: TAG } } });
  await prisma.warehouse.deleteMany({ where: { code: { contains: TAG } } });
}

let rnd = 0.37;
function nextRandom() { rnd = (rnd + 0.031) % 1; return rnd; }

async function seedStock(pid: string, qty: number, cost: string) {
  await prisma.warehouseInventory.upsert({
    where: { warehouseId_productId_batchNumber: { warehouseId, productId: pid, batchNumber: "" } },
    update: { quantity: qty, avgCost: cost },
    create: { warehouseId, productId: pid, quantity: qty, avgCost: cost },
  });
}

async function getQty(pid: string): Promise<number> {
  const rows = await prisma.warehouseInventory.findMany({
    where: { warehouseId, productId: pid, batchNumber: "" },
  });
  return rows.reduce((s, r) => s + r.quantity, 0);
}

describeIf("P2-3: Giao hÃ ng side-effect kho", () => {
  beforeAll(async () => {
    await cleanup();
    const c = await prisma.customer.create({ data: { name: `${TAG}-KH` } });
    customerId = c.id;
    const w = await prisma.warehouse.create({ data: { code: `${TAG}-WH`, name: "Kho test" } });
    warehouseId = w.id;
    const p1 = await prisma.product.create({ data: { sku: `${TAG}-P1`, name: "SP1", unit: "cÃ¡i" } });
    const p2 = await prisma.product.create({ data: { sku: `${TAG}-P2`, name: "SP2", unit: "cÃ¡i" } });
    product1Id = p1.id;
    product2Id = p2.id;
  });
  afterAll(async () => { await cleanup(); await prisma.$disconnect(); });
  beforeEach(async () => {
    await seedStock(product1Id, 20, "100");
    await seedStock(product2Id, 15, "200");
  });

  it("WAREHOUSE: giao hÃ ng â†’ DELIVERED + tá»“n giáº£m Ä‘Ãºng (P1: 20â†’18, P2: 15â†’12)", async () => {
    const so = await OrderOrchestrator.createWarehouseOrder(
      {
        customerId, warehouseId, fulfillmentType: "WAREHOUSE",
        commissionAmount: "0",
        items: [
          { productId: product1Id, productName: "SP1", unit: "cÃ¡i", qty: 2, sellPrice: "15000", baseCost: "100", taxAmount: "0" },
          { productId: product2Id, productName: "SP2", unit: "cÃ¡i", qty: 3, sellPrice: "25000", baseCost: "200", taxAmount: "0" },
        ],
      },
      { now: new Date(), random: nextRandom() }, prisma,
    );

    const delivered = await OrderOrchestrator.deliverSalesOrder(so.id, { now: new Date() }, prisma);
    expect(delivered.status).toBe("DELIVERED");

    expect(await getQty(product1Id)).toBe(18); // 20 - 2
    expect(await getQty(product2Id)).toBe(12); // 15 - 3
  });

  it("Idempotent: giao hÃ ng 2 láº§n â†’ tá»“n chá»‰ giáº£m 1 láº§n", async () => {
    const so = await OrderOrchestrator.createWarehouseOrder(
      {
        customerId, warehouseId, fulfillmentType: "WAREHOUSE",
        commissionAmount: "0",
        items: [{ productId: product1Id, productName: "SP1", unit: "cÃ¡i", qty: 5, sellPrice: "10000", baseCost: "100", taxAmount: "0" }],
      },
      { now: new Date(), random: nextRandom() }, prisma,
    );
    await OrderOrchestrator.deliverSalesOrder(so.id, {}, prisma);
    // Láº§n 2: recordMovement idempotent â†’ khÃ´ng trá»« tiáº¿p
    await OrderOrchestrator.deliverSalesOrder(so.id, {}, prisma);
    expect(await getQty(product1Id)).toBe(15); // 20 - 5, khÃ´ng pháº£i 20 - 10
  });
});

describeIf("P2-4: Há»§y Ä‘Æ¡n â€” hoÃ n kho", () => {
  beforeAll(async () => {
    await cleanup();
    const c = await prisma.customer.create({ data: { name: `${TAG}-KH` } });
    customerId = c.id;
    const s = await prisma.supplier.create({ data: { name: `${TAG}-NCC` } });
    supplierId = s.id;
    const w = await prisma.warehouse.create({ data: { code: `${TAG}-WH2`, name: "Kho test 2" } });
    warehouseId = w.id;
    const p1 = await prisma.product.create({ data: { sku: `${TAG}-P1`, name: "SP1", unit: "cÃ¡i" } });
    product1Id = p1.id;
  });
  afterAll(async () => { await cleanup(); await prisma.$disconnect(); });
  beforeEach(async () => {
    await seedStock(product1Id, 50, "100");
  });

  it("Há»§y SO PENDING â†’ CANCELLED, tá»“n khÃ´ng Ä‘á»•i", async () => {
    const so = await OrderOrchestrator.createWarehouseOrder(
      {
        customerId, warehouseId, fulfillmentType: "WAREHOUSE",
        commissionAmount: "0",
        items: [{ productId: product1Id, productName: "SP1", unit: "cÃ¡i", qty: 5, sellPrice: "10000", baseCost: "100", taxAmount: "0" }],
      },
      { now: new Date(), random: nextRandom() }, prisma,
    );
    const before = await getQty(product1Id);
    const cancelled = await OrderOrchestrator.cancelSalesOrder(so.id, {}, prisma);
    expect(cancelled.status).toBe("CANCELLED");
    expect(await getQty(product1Id)).toBe(before); // chÆ°a giao â†’ khÃ´ng hoÃ n
  });

  it("Há»§y SO Ä‘Ã£ DELIVERED â†’ CANCELLED + hoÃ n kho", async () => {
    const so = await OrderOrchestrator.createWarehouseOrder(
      {
        customerId, warehouseId, fulfillmentType: "WAREHOUSE",
        commissionAmount: "0",
        items: [{ productId: product1Id, productName: "SP1", unit: "cÃ¡i", qty: 7, sellPrice: "10000", baseCost: "100", taxAmount: "0" }],
      },
      { now: new Date(), random: nextRandom() }, prisma,
    );
    await OrderOrchestrator.deliverSalesOrder(so.id, {}, prisma);
    const afterDelivery = await getQty(product1Id); // 50 - 7 = 43
    expect(afterDelivery).toBe(43);

    const cancelled = await OrderOrchestrator.cancelSalesOrder(so.id, {}, prisma);
    expect(cancelled.status).toBe("CANCELLED");
    // HoÃ n kho: 43 + 7 = 50
    expect(await getQty(product1Id)).toBe(50);
  });

  it("Há»§y PO ORDERED â†’ CANCELLED, khÃ´ng side-effect kho", async () => {
    const po = await prisma.purchaseOrder.create({
      data: {
        orderCode: `${TAG}-PO-${Date.now()}`,
        status: "ORDERED",
        paymentStatus: "UNPAID",
        supplierId,
        warehouseId,
        totalAmount: "10000",
        items: { create: [{ productId: product1Id, productName: "SP1", unit: "cÃ¡i", qty: 5, buyPrice: "2000", buyTotal: "10000" }] },
      },
    });
    const cancelled = await OrderOrchestrator.cancelPurchaseOrder(po.id, {}, prisma);
    expect(cancelled.status).toBe("CANCELLED");
    // ChÆ°a RECEIVED â†’ khÃ´ng hoÃ n
    expect(await getQty(product1Id)).toBe(50);
  });

  it("Há»§y PO Ä‘Ã£ RECEIVED â†’ CANCELLED + hoÃ n kho (RETURN_OUT)", async () => {
    const po = await OrderOrchestrator.createDropshipOrder(
      {
        customerId,
        commissionAmount: "0",
        items: [{ productId: product1Id, productName: "SP1", unit: "cái", qty: 4, sellPrice: "3000", buyPrice: "2000", baseCost: "0", taxAmount: "0", purchaseTaxAmount: "0", supplierId }],
      },
      { now: new Date(), random: nextRandom() }, prisma,
    ).then(r => r.purchaseOrders[0]);

    // Set warehouseId + nháº­n hÃ ng
    await prisma.purchaseOrder.update({ where: { id: po!.id }, data: { warehouseId } });
    await OrderOrchestrator.receivePurchaseOrder(po!.id, {}, prisma);
    const afterRecv = await getQty(product1Id); // 50 + 4 = 54
    expect(afterRecv).toBe(54);

    await OrderOrchestrator.cancelPurchaseOrder(po!.id, {}, prisma);
    // HoÃ n kho: 54 - 4 = 50
    expect(await getQty(product1Id)).toBe(50);
  });

  it("Há»§y SO DROPSHIP â†’ Ä‘á»“ng bá»™ há»§y cáº£ PO (C5: khÃ´ng PO treo)", async () => {
    const { salesOrder, purchaseOrders } = await OrderOrchestrator.createDropshipOrder(
      {
        customerId,
        commissionAmount: "0",
        items: [{ productId: product1Id, productName: "SP-DS", unit: "cái", qty: 3, sellPrice: "5000", buyPrice: "3000", baseCost: "0", taxAmount: "0", purchaseTaxAmount: "0", supplierId }],
      },
      { now: new Date(), random: nextRandom() }, prisma,
    );
    // Giao dropship â†’ DELIVERED (movement áº£o)
    await OrderOrchestrator.deliverSalesOrder(salesOrder.id, {}, prisma);

    // Há»§y SO â†’ pháº£i Ä‘á»“ng bá»™ há»§y PO
    await OrderOrchestrator.cancelSalesOrder(salesOrder.id, {}, prisma);

    const so = await prisma.salesOrder.findUniqueOrThrow({ where: { id: salesOrder.id } });
    const po = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: purchaseOrders[0]!.id } });
    expect(so.status).toBe("CANCELLED");
    expect(po.status).toBe("CANCELLED"); // C5: khÃ´ng PO treo
  });
});


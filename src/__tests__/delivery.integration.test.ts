/**
 * Integration test P2-3 — Giao hàng (side-effect kho).
 *
 * AC:
 * 1. WAREHOUSE DELIVERED → xuất kho SALES_SHIPMENT (tồn giảm đúng).
 * 2. DROPSHIP DELIVERED → movement DROPSHIP_OUT (xuất ảo, không kho).
 * 3. Idempotent: handleDelivery gọi lại → KHÔNG double-movement.
 * 4. Xuất quá tồn → throw, không mất hàng.
 * 5. Outbox pattern: event → PROCESSING → DONE.
 *
 * Tự skip nếu không có DATABASE_URL.
 * Mỗi test tự seed inventory riêng để không phụ thuộc lẫn nhau.
 */
import { config } from "dotenv";
config();

import { PrismaClient, type OrderStatus } from "@prisma/client";
import { SalesOrderService } from "@/services/sales-order.service";
import { OutboxService } from "@/services/outbox.service";
import { DeliveryService } from "@/services/delivery.service";
import { MOVEMENT_REASON, MOVEMENT_TYPE, REFERENCE_TYPE, FULFILLMENT_TYPE } from "@/domain/constants";

const hasDb = !!process.env.DATABASE_URL;
const describeIf = hasDb ? describe : describe.skip;
jest.setTimeout(150_000); // remote DB cần timeout lớn

const prisma = new PrismaClient();
const TAG = "__del_it__";

// Seed dùng chung (tạo 1 lần, các test tự quản lý inventory riêng)
let customerId: string;
let warehouseId: string;
let productId: string;
let productId2: string;

async function cleanupAll() {
  // Xoá tất cả dữ liệu test còn sót
  const sos = await prisma.salesOrder.findMany({
    where: { customer: { name: { contains: TAG } } },
    select: { id: true },
  });
  const soIds = sos.map((s) => s.id);

  if (soIds.length) {
    await prisma.inventoryMovement.deleteMany({
      where: { referenceType: REFERENCE_TYPE.SALES_ORDER, referenceId: { in: soIds } },
    });
    await prisma.orderStatusHistory.deleteMany({
      where: { referenceId: { in: soIds } },
    });
    await prisma.outboxEvent.deleteMany({
      where: { idempotencyKey: { in: soIds.map((id) => `delivery:${id}`) } },
    });
    await prisma.salesOrderItem.deleteMany({ where: { salesOrderId: { in: soIds } } });
    await prisma.salesOrder.deleteMany({ where: { id: { in: soIds } } });
  }

  await prisma.warehouseInventory.deleteMany({
    where: { product: { name: { contains: TAG } } },
  });
  await prisma.product.deleteMany({ where: { name: { contains: TAG } } });
  await prisma.customer.deleteMany({ where: { name: { contains: TAG } } });
  await prisma.warehouse.deleteMany({ where: { name: { contains: TAG } } });
}

/** Seed inventory về giá trị mặc định cho 1 test. */
async function resetInventory() {
  // Xoá inventory cũ
  await prisma.warehouseInventory.deleteMany({
    where: { warehouseId, productId: { in: [productId, productId2] } },
  });
  // Seed mới
  await prisma.warehouseInventory.create({
    data: { warehouseId, productId, quantity: 100, avgCost: "5000" },
  });
  await prisma.warehouseInventory.create({
    data: { warehouseId, productId: productId2, quantity: 50, avgCost: "8000" },
  });
}

let rnd = 0.5;
function nextRandom() {
  rnd = (rnd + 0.037) % 1;
  return rnd;
}

describeIf("Delivery integration (P2-3)", () => {
  beforeAll(async () => {
    await cleanupAll();

    const c = await prisma.customer.create({ data: { name: `${TAG}-KH` } });
    customerId = c.id;

    const w = await prisma.warehouse.create({ data: { code: `${TAG}-KHO`, name: `${TAG}-Kho chính` } });
    warehouseId = w.id;

    const p1 = await prisma.product.create({
      data: { sku: `${TAG}-SP1`, name: `${TAG}-Sản phẩm 1`, unit: "cái", buyPrice: "5000", sellPrice: "10000" },
    });
    productId = p1.id;

    const p2 = await prisma.product.create({
      data: { sku: `${TAG}-SP2`, name: `${TAG}-Sản phẩm 2`, unit: "hộp", buyPrice: "8000", sellPrice: "15000" },
    });
    productId2 = p2.id;

    await resetInventory();
  });

  afterAll(async () => {
    await cleanupAll();
    await prisma.$disconnect();
  });

  // ===================================================================
  // AC1: WAREHOUSE DELIVERED → xuất kho SALES_SHIPMENT, tồn giảm đúng
  // ===================================================================
  it("WAREHOUSE: DELIVERED → tồn giảm đúng qty mỗi item (SALES_SHIPMENT)", async () => {
    await resetInventory();

    const so = await SalesOrderService.create(
      {
        customerId,
        warehouseId,
        fulfillmentType: FULFILLMENT_TYPE.WAREHOUSE,
        items: [
          { productName: `${TAG}-SP1`, unit: "cái", qty: 3, sellPrice: "10000", baseCost: "5000", taxAmount: "0", productId },
          { productName: `${TAG}-SP2`, unit: "hộp", qty: 2, sellPrice: "15000", baseCost: "8000", taxAmount: "0", productId: productId2 },
        ],
      },
      { now: new Date(), random: nextRandom() },
      prisma,
    );
    expect(so.status).toBe("PENDING");

    // Transaction: register delivery event + update status → DELIVERED
    await prisma.$transaction(async (tx) => {
      await DeliveryService.registerDeliveryEvent(tx, so.id);
      await SalesOrderService.updateStatus(tx, so.id, "DELIVERED" as OrderStatus);
    });

    // Verify SO đã DELIVERED
    const soDelivered = await prisma.salesOrder.findUniqueOrThrow({ where: { id: so.id } });
    expect(soDelivered.status).toBe("DELIVERED");

    // Process outbox event
    const events = await OutboxService.getPending(prisma, 10, new Date());
    const deliveryEvent = events.find((e) => e.idempotencyKey === `delivery:${so.id}`);
    expect(deliveryEvent).toBeDefined();
    expect(deliveryEvent!.type).toBe("SALES_DELIVERY");

    await DeliveryService.processDelivery(prisma, deliveryEvent!.id);

    // Verify movements: 2 movements SALES_SHIPMENT
    const movements = await prisma.inventoryMovement.findMany({
      where: { referenceType: REFERENCE_TYPE.SALES_ORDER, referenceId: so.id },
      orderBy: { createdAt: "asc" },
    });
    expect(movements).toHaveLength(2);

    const m1 = movements.find((m) => m.productId === productId)!;
    expect(m1.type).toBe(MOVEMENT_TYPE.OUT);
    expect(m1.reason).toBe(MOVEMENT_REASON.SALES_SHIPMENT);
    expect(m1.quantity).toBe(3);
    expect(m1.warehouseId).toBe(warehouseId);

    const m2 = movements.find((m) => m.productId === productId2)!;
    expect(m2.type).toBe(MOVEMENT_TYPE.OUT);
    expect(m2.reason).toBe(MOVEMENT_REASON.SALES_SHIPMENT);
    expect(m2.quantity).toBe(2);
    expect(m2.warehouseId).toBe(warehouseId);

    // Verify tồn giảm đúng
    const inv1 = await prisma.warehouseInventory.findUniqueOrThrow({
      where: { warehouseId_productId_batchNumber: { warehouseId, productId, batchNumber: "" } },
    });
    expect(Number(inv1.quantity)).toBe(97); // 100 - 3

    const inv2 = await prisma.warehouseInventory.findUniqueOrThrow({
      where: { warehouseId_productId_batchNumber: { warehouseId, productId: productId2, batchNumber: "" } },
    });
    expect(Number(inv2.quantity)).toBe(48); // 50 - 2

    // Verify outbox event DONE
    const doneEvent = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: deliveryEvent!.id } });
    expect(doneEvent.status).toBe("DONE");

    // Verify profit được cập nhật
    const items = await prisma.salesOrderItem.findMany({ where: { salesOrderId: so.id } });
    for (const item of items) {
      const sellTotal = Number(item.sellTotal);
      const costTotal = Number(item.baseCost) * item.qty;
      const expectedProfit = sellTotal - costTotal;
      expect(Number(item.profit)).toBe(expectedProfit);
    }
  });

  // ===================================================================
  // AC2: DROPSHIP DELIVERED → movement DROPSHIP_OUT, không ảnh hưởng tồn
  // ===================================================================
  it("DROPSHIP: DELIVERED → movement DROPSHIP_OUT, tồn không đổi", async () => {
    await resetInventory();

    const so = await SalesOrderService.create(
      {
        customerId,
        fulfillmentType: FULFILLMENT_TYPE.DROPSHIP,
        items: [
          { productName: `${TAG}-SP1`, unit: "cái", qty: 5, sellPrice: "10000", baseCost: "5000", taxAmount: "0", productId },
        ],
      },
      { now: new Date(), random: nextRandom() },
      prisma,
    );
    expect(so.status).toBe("PENDING");

    // Transaction: register + updateStatus
    await prisma.$transaction(async (tx) => {
      await DeliveryService.registerDeliveryEvent(tx, so.id);
      await SalesOrderService.updateStatus(tx, so.id, "DELIVERED" as OrderStatus);
    });

    // Process outbox
    const events = await OutboxService.getPending(prisma, 10, new Date());
    const deliveryEvent = events.find((e) => e.idempotencyKey === `delivery:${so.id}`);
    expect(deliveryEvent).toBeDefined();
    await DeliveryService.processDelivery(prisma, deliveryEvent!.id);

    // Verify movement: 1 movement DROPSHIP_OUT, warehouseId = null
    const movements = await prisma.inventoryMovement.findMany({
      where: { referenceType: REFERENCE_TYPE.SALES_ORDER, referenceId: so.id },
    });
    expect(movements).toHaveLength(1);
    const m = movements[0]!;
    expect(m.reason).toBe(MOVEMENT_REASON.DROPSHIP_OUT);
    expect(m.type).toBe(MOVEMENT_TYPE.OUT);
    expect(m.warehouseId).toBeNull();
    expect(m.quantity).toBe(5);

    // Verify tồn kho không đổi (vẫn 100)
    const inv = await prisma.warehouseInventory.findUniqueOrThrow({
      where: { warehouseId_productId_batchNumber: { warehouseId, productId, batchNumber: "" } },
    });
    expect(Number(inv.quantity)).toBe(100);

    // Verify event DONE
    const doneEvent = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: deliveryEvent!.id } });
    expect(doneEvent.status).toBe("DONE");
  });

  // ===================================================================
  // AC3: Idempotent — gọi lại handleDelivery → không double-movement
  // ===================================================================
  it("Idempotent: handleDelivery gọi lại → không tạo movement mới", async () => {
    await resetInventory();

    const so = await SalesOrderService.create(
      {
        customerId,
        warehouseId,
        fulfillmentType: FULFILLMENT_TYPE.WAREHOUSE,
        items: [
          { productName: `${TAG}-SP1`, unit: "cái", qty: 1, sellPrice: "10000", baseCost: "5000", taxAmount: "0", productId },
        ],
      },
      { now: new Date(), random: nextRandom() },
      prisma,
    );

    // Transaction: register + updateStatus
    await prisma.$transaction(async (tx) => {
      await DeliveryService.registerDeliveryEvent(tx, so.id);
      await SalesOrderService.updateStatus(tx, so.id, "DELIVERED" as OrderStatus);
    });

    // Process lần 1
    const events1 = await OutboxService.getPending(prisma, 10, new Date());
    const ev1 = events1.find((e) => e.idempotencyKey === `delivery:${so.id}`)!;
    await DeliveryService.processDelivery(prisma, ev1.id);

    // Count movements sau lần 1
    const count1 = await prisma.inventoryMovement.count({
      where: { referenceType: REFERENCE_TYPE.SALES_ORDER, referenceId: so.id },
    });
    expect(count1).toBe(1); // 1 item

    // Gọi lại handleDelivery trực tiếp — idempotent nhờ @@unique
    await prisma.$transaction(async (tx) => {
      await DeliveryService.handleDelivery(tx, so.id);
    });

    // Count vẫn là 1 (không tăng)
    const count2 = await prisma.inventoryMovement.count({
      where: { referenceType: REFERENCE_TYPE.SALES_ORDER, referenceId: so.id },
    });
    expect(count2).toBe(1);

    // Tồn giảm đúng 1
    const inv = await prisma.warehouseInventory.findUniqueOrThrow({
      where: { warehouseId_productId_batchNumber: { warehouseId, productId, batchNumber: "" } },
    });
    expect(Number(inv.quantity)).toBe(99); // 100 - 1
  });

  // ===================================================================
  // AC4: Xuất quá tồn → bị chặn (ValidationError)
  // ===================================================================
  it("Xuất quá tồn → throw, không mất hàng", async () => {
    await resetInventory();

    // Tạo SO với qty lớn hơn tồn (SP1 = 100)
    const so = await SalesOrderService.create(
      {
        customerId,
        warehouseId,
        fulfillmentType: FULFILLMENT_TYPE.WAREHOUSE,
        items: [
          { productName: `${TAG}-SP1`, unit: "cái", qty: 999, sellPrice: "10000", baseCost: "5000", taxAmount: "0", productId },
        ],
      },
      { now: new Date(), random: nextRandom() },
      prisma,
    );

    // Tạo outbox event + update status
    await prisma.$transaction(async (tx) => {
      await DeliveryService.registerDeliveryEvent(tx, so.id);
      await SalesOrderService.updateStatus(tx, so.id, "DELIVERED" as OrderStatus);
    });

    // Gọi processDelivery → phải throw
    const events = await OutboxService.getPending(prisma, 10, new Date());
    const ev = events.find((e) => e.idempotencyKey === `delivery:${so.id}`);
    expect(ev).toBeDefined();

    await expect(
      DeliveryService.processDelivery(prisma, ev!.id),
    ).rejects.toThrow("Kho không đủ hàng");

    // Tồn không đổi
    const inv = await prisma.warehouseInventory.findUniqueOrThrow({
      where: { warehouseId_productId_batchNumber: { warehouseId, productId, batchNumber: "" } },
    });
    expect(Number(inv.quantity)).toBe(100);

    // Event chuyển DEAD (sau 1 lần thất bại thì markFailed chạy → attempts=1, nếu k đủ MAX_ATTEMPTS thì PENDING)
    // processDelivery gọi markFailed bên trong → attempts=1 → PENDING với backoff
    // Ta verify attempts tăng
    const deadEvent = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: ev!.id } });
    expect(deadEvent.attempts).toBe(1);
    // status là PENDING (vì chưa đạt MAX_ATTEMPTS) — system sẽ retry sau
    expect(deadEvent.status).not.toBe("DONE");
  });

  // ===================================================================
  // AC5: Outbox lifecycle — event → PROCESSING → DONE
  // ===================================================================
  it("Outbox lifecycle: PENDING → PROCESSING → DONE", async () => {
    await resetInventory();

    const so = await SalesOrderService.create(
      {
        customerId,
        warehouseId,
        fulfillmentType: FULFILLMENT_TYPE.WAREHOUSE,
        items: [
          { productName: `${TAG}-SP1`, unit: "cái", qty: 2, sellPrice: "10000", baseCost: "5000", taxAmount: "0", productId },
        ],
      },
      { now: new Date(), random: nextRandom() },
      prisma,
    );

    // register + updateStatus trong 1 transaction
    await prisma.$transaction(async (tx) => {
      await DeliveryService.registerDeliveryEvent(tx, so.id);
      await SalesOrderService.updateStatus(tx, so.id, "DELIVERED" as OrderStatus);
    });

    // Lấy event từ outbox — getPending đánh dấu PROCESSING
    const events = await OutboxService.getPending(prisma, 10, new Date());
    const ev = events.find((e) => e.idempotencyKey === `delivery:${so.id}`);
    expect(ev).toBeDefined();
    expect(ev!.status).toBe("PROCESSING");
    expect(ev!.type).toBe("SALES_DELIVERY");

    // Process
    await DeliveryService.processDelivery(prisma, ev!.id);

    // Verify DONE
    const done = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: ev!.id } });
    expect(done.status).toBe("DONE");

    // Tồn giảm đúng
    const inv = await prisma.warehouseInventory.findUniqueOrThrow({
      where: { warehouseId_productId_batchNumber: { warehouseId, productId, batchNumber: "" } },
    });
    expect(Number(inv.quantity)).toBe(98); // 100 - 2
  });
});
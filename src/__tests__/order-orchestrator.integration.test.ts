/**
 * Integration test OrderOrchestrator (P2-2, invariant C5) — DB THẬT (Neon).
 *
 * AC:
 * - tạo WAREHOUSE thành công (SO PENDING, không PO).
 * - tạo DROPSHIP thành công: PO (ORDERED) + SO link linkedPurchaseOrderId đúng.
 * - ROLLBACK nguyên vẹn: 1 bước lỗi (customerId FK sai) → KHÔNG còn PO lẫn SO.
 * Tự skip nếu không có DATABASE_URL.
 */
import { config } from "dotenv";
config();

import { PrismaClient } from "@prisma/client";
import { OrderOrchestrator } from "@/services/order-orchestrator.service";

const hasDb = !!process.env.DATABASE_URL;
const describeIf = hasDb ? describe : describe.skip;
jest.setTimeout(60_000);

const prisma = new PrismaClient();
const TAG = "__orch_it__";

let customerId: string;
let supplierId: string;

async function cleanup() {
  const sos = await prisma.salesOrder.findMany({
    where: { customer: { name: { contains: TAG } } },
    select: { id: true },
  });
  const pos = await prisma.purchaseOrder.findMany({
    where: { supplier: { name: { contains: TAG } } },
    select: { id: true },
  });
  const ids = [...sos.map((s) => s.id), ...pos.map((p) => p.id)];
  if (ids.length) {
    await prisma.orderStatusHistory.deleteMany({ where: { referenceId: { in: ids } } });
  }
  await prisma.salesOrder.deleteMany({ where: { customer: { name: { contains: TAG } } } });
  await prisma.purchaseOrder.deleteMany({ where: { supplier: { name: { contains: TAG } } } });
  await prisma.customer.deleteMany({ where: { name: { contains: TAG } } });
  await prisma.supplier.deleteMany({ where: { name: { contains: TAG } } });
}

let rnd = 0.1;
function nextRandom() {
  rnd = (rnd + 0.023) % 1;
  return rnd;
}

describeIf("OrderOrchestrator integration (C5)", () => {
  beforeAll(async () => {
    await cleanup();
    const c = await prisma.customer.create({ data: { name: `${TAG}-KH` } });
    const s = await prisma.supplier.create({ data: { name: `${TAG}-NCC` } });
    customerId = c.id;
    supplierId = s.id;
  });
  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("WAREHOUSE: tạo SO PENDING, không sinh PO", async () => {
    const so = await OrderOrchestrator.createWarehouseOrder(
      {
        customerId,
        fulfillmentType: "WAREHOUSE",
        items: [{ productName: "SP1", unit: "cái", qty: 2, sellPrice: "10000", baseCost: "6000", taxAmount: "0" }],
      },
      { now: new Date(), random: nextRandom() },
      prisma,
    );
    expect(so.status).toBe("PENDING");
    expect(so.fulfillmentType).toBe("WAREHOUSE");
    expect(so.linkedPurchaseOrderId).toBeNull();
    expect(so.totalAmount.toString()).toBe("20000");
  });

  it("DROPSHIP: tạo PO (ORDERED) + SO link đúng, cùng transaction", async () => {
    const { salesOrder, purchaseOrder } = await OrderOrchestrator.createDropshipOrder(
      {
        customerId,
        supplierId,
        items: [
          {
            productName: "SP-DS",
            unit: "cái",
            qty: 5,
            sellPrice: "12000",
            baseCost: "0",
            taxAmount: "0",
            buyPrice: "8000",
          },
        ],
      },
      { now: new Date(), random: nextRandom() },
      prisma,
    );

    expect(purchaseOrder.status).toBe("ORDERED");
    expect(purchaseOrder.totalAmount.toString()).toBe("40000"); // 5*8000
    expect(salesOrder.fulfillmentType).toBe("DROPSHIP");
    expect(salesOrder.linkedPurchaseOrderId).toBe(purchaseOrder.id);
    expect(salesOrder.totalAmount.toString()).toBe("60000"); // 5*12000

    // Verify từ DB độc lập: cả 2 tồn tại, link khớp
    const soDb = await prisma.salesOrder.findUniqueOrThrow({ where: { id: salesOrder.id } });
    const poDb = await prisma.purchaseOrder.findUniqueOrThrow({
      where: { id: purchaseOrder.id },
    });
    expect(soDb.linkedPurchaseOrderId).toBe(poDb.id);
  });

  it("ROLLBACK: DROPSHIP với customerId sai FK → KHÔNG còn PO lẫn SO", async () => {
    const poBefore = await prisma.purchaseOrder.count({
      where: { supplier: { name: { contains: TAG } } },
    });
    const soBefore = await prisma.salesOrder.count({
      where: { customer: { name: { contains: TAG } } },
    });

    await expect(
      OrderOrchestrator.createDropshipOrder(
        {
          customerId: "khong-ton-tai-fk", // gây lỗi FK ở bước tạo SO (sau khi PO đã tạo)
          supplierId,
          items: [
            {
              productName: "SP-FAIL",
              unit: "cái",
              qty: 1,
              sellPrice: "1000",
              baseCost: "0",
              taxAmount: "0",
              buyPrice: "500",
            },
          ],
        },
        { now: new Date(), random: nextRandom() },
        prisma,
      ),
    ).rejects.toBeTruthy();

    // Số PO/SO KHÔNG tăng → PO tạo ở bước 1 đã rollback cùng SO lỗi
    const poAfter = await prisma.purchaseOrder.count({
      where: { supplier: { name: { contains: TAG } } },
    });
    const soAfter = await prisma.salesOrder.count({
      where: { customer: { name: { contains: TAG } } },
    });
    expect(poAfter).toBe(poBefore);
    expect(soAfter).toBe(soBefore);

    // Không có PO "SP-FAIL" treo
    const orphan = await prisma.purchaseOrderItem.count({
      where: { productName: "SP-FAIL" },
    });
    expect(orphan).toBe(0);
  });
});

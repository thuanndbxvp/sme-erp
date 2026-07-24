/**
 * Integration test OrderOrchestrator (P2-2, invariant C5) â€” DB THáº¬T (Neon).
 *
 * AC:
 * - táº¡o WAREHOUSE thÃ nh cÃ´ng (SO PENDING, khÃ´ng PO).
 * - táº¡o DROPSHIP thÃ nh cÃ´ng: PO (ORDERED) + SO link linkedPurchaseOrderId Ä‘Ãºng.
 * - ROLLBACK nguyÃªn váº¹n: 1 bÆ°á»›c lá»—i (customerId FK sai) â†’ KHÃ”NG cÃ²n PO láº«n SO.
 * Tá»± skip náº¿u khÃ´ng cÃ³ DATABASE_URL.
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

  it("WAREHOUSE: táº¡o SO PENDING, khÃ´ng sinh PO", async () => {
    const so = await OrderOrchestrator.createWarehouseOrder(
      {
        customerId,
        fulfillmentType: "WAREHOUSE",
        commissionAmount: "0",
        items: [{ productName: "SP1", unit: "cÃ¡i", qty: 2, sellPrice: "10000", baseCost: "6000", taxAmount: "0" }],
      },
      { now: new Date(), random: nextRandom() },
      prisma,
    );
    expect(so.status).toBe("PENDING");
    expect(so.fulfillmentType).toBe("WAREHOUSE");
    expect(so.totalAmount.toString()).toBe("20000");
  });

  it("DROPSHIP: táº¡o PO (ORDERED) + SO link Ä‘Ãºng, cÃ¹ng transaction", async () => {
    const { salesOrder, purchaseOrders } = await OrderOrchestrator.createDropshipOrder(
      {
        customerId,
        commissionAmount: "0",
        items: [
          {
            productName: "SP-DS",
            unit: "cái",
            qty: 5,
            sellPrice: "12000",
            baseCost: "0",
            taxAmount: "0",
            buyPrice: "8000",
            purchaseTaxAmount: "0",
            supplierId,
          },
        ],
      },
      { now: new Date(), random: nextRandom() },
      prisma,
    );
    const purchaseOrder = purchaseOrders[0];

    expect(purchaseOrder!.status).toBe("ORDERED");
    expect(purchaseOrder!.totalAmount.toString()).toBe("40000"); // 5*8000
    expect(salesOrder.fulfillmentType).toBe("DROPSHIP");
    expect(purchaseOrder!.linkedSalesOrderId).toBe(salesOrder.id);
    expect(salesOrder.totalAmount.toString()).toBe("60000"); // 5*12000

    // Verify tá»« DB Ä‘á»™c láº­p: cáº£ 2 tá»“n táº¡i, link khá»›p
    const soDb = await prisma.salesOrder.findUniqueOrThrow({ where: { id: salesOrder.id } });
    const poDb = await prisma.purchaseOrder.findUniqueOrThrow({
      where: { id: purchaseOrder!.id },
    });
    expect(poDb.linkedSalesOrderId).toBe(soDb.id);
  });

  it("ROLLBACK: DROPSHIP vá»›i customerId sai FK â†’ KHÃ”NG cÃ²n PO láº«n SO", async () => {
    const poBefore = await prisma.purchaseOrder.count({
      where: { supplier: { name: { contains: TAG } } },
    });
    const soBefore = await prisma.salesOrder.count({
      where: { customer: { name: { contains: TAG } } },
    });

    await expect(
      OrderOrchestrator.createDropshipOrder(
        {
          customerId: "khong-ton-tai-fk", // gÃ¢y lá»—i FK á»Ÿ bÆ°á»›c táº¡o SO (sau khi PO Ä‘Ã£ táº¡o)
          commissionAmount: "0",
          items: [
            {
              productName: "SP-FAIL",
              unit: "cái",
              qty: 1,
              sellPrice: "1000",
              baseCost: "0",
              taxAmount: "0",
              buyPrice: "500",
              purchaseTaxAmount: "0",
              supplierId,
            },
          ],
        },
        { now: new Date(), random: nextRandom() },
        prisma,
      ),
    ).rejects.toBeTruthy();

    // Sá»‘ PO/SO KHÃ”NG tÄƒng â†’ PO táº¡o á»Ÿ bÆ°á»›c 1 Ä‘Ã£ rollback cÃ¹ng SO lá»—i
    const poAfter = await prisma.purchaseOrder.count({
      where: { supplier: { name: { contains: TAG } } },
    });
    const soAfter = await prisma.salesOrder.count({
      where: { customer: { name: { contains: TAG } } },
    });
    expect(poAfter).toBe(poBefore);
    expect(soAfter).toBe(soBefore);

    // KhÃ´ng cÃ³ PO "SP-FAIL" treo
    const orphan = await prisma.purchaseOrderItem.count({
      where: { productName: "SP-FAIL" },
    });
    expect(orphan).toBe(0);
  });
});


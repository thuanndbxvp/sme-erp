/**
 * Integration test SO/PO service + state machine (P2-1b, invariant C4) — DB THẬT.
 *
 * AC:
 * - tạo đơn: tổng TÍNH LẠI trên server từ items (không tin client).
 * - transition hợp lệ (PENDING→DELIVERED) qua; sai (DELIVERED→PENDING) throw.
 * - race: 2 request cùng PENDING→DELIVERED → chỉ 1 thành công (không double).
 * - ghi OrderStatusHistory mỗi lần đổi.
 * Tự skip nếu không có DATABASE_URL.
 */
import { config } from "dotenv";
config();

import { PrismaClient } from "@prisma/client";
import { SalesOrderService } from "@/services/sales-order.service";
import { PurchaseOrderService } from "@/services/purchase-order.service";
import { InvalidTransitionError } from "@/domain/state-machine";
import { REFERENCE_TYPE } from "@/domain/constants";

const hasDb = !!process.env.DATABASE_URL;
const describeIf = hasDb ? describe : describe.skip;
jest.setTimeout(60_000);

const prisma = new PrismaClient();
const TAG = "__ord_it__";

let customerId: string;
let supplierId: string;

async function cleanup() {
  const orders = await prisma.salesOrder.findMany({
    where: { customer: { name: { contains: TAG } } },
    select: { id: true },
  });
  const pos = await prisma.purchaseOrder.findMany({
    where: { supplier: { name: { contains: TAG } } },
    select: { id: true },
  });
  const ids = [...orders.map((o) => o.id), ...pos.map((p) => p.id)];
  if (ids.length) {
    await prisma.orderStatusHistory.deleteMany({ where: { referenceId: { in: ids } } });
  }
  await prisma.salesOrder.deleteMany({ where: { customer: { name: { contains: TAG } } } });
  await prisma.purchaseOrder.deleteMany({ where: { supplier: { name: { contains: TAG } } } });
  await prisma.customer.deleteMany({ where: { name: { contains: TAG } } });
  await prisma.supplier.deleteMany({ where: { name: { contains: TAG } } });
}

let rnd = 0;
function nextRandom() {
  rnd += 0.017;
  return rnd % 1;
}

async function makeSO() {
  return SalesOrderService.create(
    {
      customerId,
      fulfillmentType: "WAREHOUSE",
      items: [
        { productName: "SP1", unit: "cái", qty: 3, sellPrice: "10000", baseCost: "6000", taxAmount: "0" },
        { productName: "SP2", unit: "cái", qty: 2, sellPrice: "5000", baseCost: "3000", taxAmount: "0" },
      ],
    },
    { now: new Date(), random: nextRandom() },
    prisma,
  );
}

describeIf("SO/PO service + state machine integration (C4)", () => {
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

  it("create SO: tổng tính lại server = 3*10000 + 2*5000 = 40000", async () => {
    const so = await makeSO();
    expect(so.totalAmount.toString()).toBe("40000");
    expect(so.items).toHaveLength(2);
    const item0 = so.items.find((i) => i.productName === "SP1");
    expect(item0?.sellTotal.toString()).toBe("30000");
    expect(so.status).toBe("PENDING");

    // history "tạo" được ghi
    const hist = await prisma.orderStatusHistory.findMany({
      where: { referenceType: REFERENCE_TYPE.SALES_ORDER, referenceId: so.id },
    });
    expect(hist).toHaveLength(1);
    expect(hist[0]?.toStatus).toBe("PENDING");
    expect(hist[0]?.fromStatus).toBeNull();
  });

  it("transition hợp lệ PENDING→DELIVERED qua; ghi history", async () => {
    const so = await makeSO();
    const updated = await SalesOrderService.updateStatusInTransaction(
      so.id,
      "DELIVERED",
      {},
      prisma,
    );
    expect(updated.status).toBe("DELIVERED");
    expect(updated.deliveredDate).not.toBeNull();

    const hist = await prisma.orderStatusHistory.findMany({
      where: { referenceId: so.id },
      orderBy: { createdAt: "asc" },
    });
    expect(hist.map((h) => h.toStatus)).toEqual(["PENDING", "DELIVERED"]);
  });

  it("transition sai DELIVERED→PENDING throw, status giữ nguyên", async () => {
    const so = await makeSO();
    await SalesOrderService.updateStatusInTransaction(so.id, "DELIVERED", {}, prisma);
    await expect(
      SalesOrderService.updateStatusInTransaction(so.id, "PENDING", {}, prisma),
    ).rejects.toBeInstanceOf(InvalidTransitionError);

    const after = await SalesOrderService.findByIdOrThrow(so.id, prisma);
    expect(after.status).toBe("DELIVERED");
  });

  it("CANCELLED là cuối: CANCELLED→DELIVERED throw", async () => {
    const so = await makeSO();
    await SalesOrderService.updateStatusInTransaction(so.id, "CANCELLED", {}, prisma);
    await expect(
      SalesOrderService.updateStatusInTransaction(so.id, "DELIVERED", {}, prisma),
    ).rejects.toBeInstanceOf(InvalidTransitionError);
  });

  it("RACE: 2 request cùng PENDING→DELIVERED → chỉ 1 thành công", async () => {
    const so = await makeSO();
    const results = await Promise.allSettled([
      SalesOrderService.updateStatusInTransaction(so.id, "DELIVERED", {}, prisma),
      SalesOrderService.updateStatusInTransaction(so.id, "DELIVERED", {}, prisma),
    ]);
    const ok = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;
    expect(ok).toBe(1);
    expect(failed).toBe(1);

    // Chỉ 1 lần chuyển DELIVERED được ghi history (không double side-effect)
    const delivered = await prisma.orderStatusHistory.count({
      where: { referenceId: so.id, toStatus: "DELIVERED" },
    });
    expect(delivered).toBe(1);
  });

  it("PO: create tính tổng + ORDERED→RECEIVED hợp lệ, RECEIVED→ORDERED throw", async () => {
    const po = await PurchaseOrderService.create(
      {
        supplierId,
        items: [{ productName: "NL1", unit: "kg", qty: 10, buyPrice: "2000", taxAmount: "0" }],
      },
      { now: new Date(), random: nextRandom() },
      prisma,
    );
    expect(po.totalAmount.toString()).toBe("20000");
    expect(po.status).toBe("ORDERED");

    const recv = await PurchaseOrderService.updateStatusInTransaction(
      po.id,
      "RECEIVED",
      {},
      prisma,
    );
    expect(recv.status).toBe("RECEIVED");

    await expect(
      PurchaseOrderService.updateStatusInTransaction(po.id, "ORDERED", {}, prisma),
    ).rejects.toBeInstanceOf(InvalidTransitionError);
  });
});

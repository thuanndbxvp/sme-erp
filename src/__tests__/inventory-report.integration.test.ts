/**
 * Integration test InventoryReportService (P1-4) — DB THẬT (Neon).
 *
 * AC: giá trị tồn (qty*avgCost) khớp BASELINE TÍNH TAY (Mục F — không so output cũ).
 *
 * Kịch bản cố định (tạo tồn qua recordMovement để avgCost là thật):
 *   Kho A: SP1 nhập 10@100 rồi 20@130  → qty 30, avgCost 120  → giá trị 3600
 *          SP2 nhập 5@200               → qty 5,  avgCost 200  → giá trị 1000
 *   Kho B: SP1 nhập 4@50                → qty 4,  avgCost 50   → giá trị 200
 * Baseline tính tay:
 *   stockByProduct (toàn hệ): SP1 qty 34 giá trị 3800; SP2 qty 5 giá trị 1000
 *   stockByProduct(kho A): SP1 3600, SP2 1000
 *   stockByWarehouse: A = 4600, B = 200
 *   totalStockValue = 4800
 */
import { config } from "dotenv";
config();

import { PrismaClient } from "@prisma/client";
import { InventoryService } from "@/services/inventory.service";
import { InventoryReportService } from "@/services/inventory-report.service";
import { MOVEMENT_TYPE, MOVEMENT_REASON, REFERENCE_TYPE } from "@/domain/constants";

const hasDb = !!process.env.DATABASE_URL;
const describeIf = hasDb ? describe : describe.skip;
jest.setTimeout(60_000);

const prisma = new PrismaClient();
const TAG = "__invrep_it__";

let whA: string;
let whB: string;
let sp1: string;
let sp2: string;

async function cleanup() {
  await prisma.inventoryMovement.deleteMany({ where: { referenceId: { contains: TAG } } });
  await prisma.warehouseInventory.deleteMany({
    where: { product: { sku: { contains: TAG } } },
  });
  await prisma.product.deleteMany({ where: { sku: { contains: TAG } } });
  await prisma.warehouse.deleteMany({ where: { code: { contains: TAG } } });
}

async function inMove(wh: string, pid: string, qty: number, cost: string, ref: string) {
  await InventoryService.recordMovementInTransaction(
    {
      type: MOVEMENT_TYPE.IN,
      reason: MOVEMENT_REASON.PURCHASE_RECEIPT,
      productId: pid,
      warehouseId: wh,
      quantity: qty,
      unitCost: cost,
      referenceType: REFERENCE_TYPE.PURCHASE_ORDER,
      referenceId: `${TAG}-${ref}`,
    },
    prisma,
  );
}

describeIf("InventoryReportService integration (P1-4)", () => {
  beforeAll(async () => {
    await cleanup();
    const a = await prisma.warehouse.create({ data: { code: `${TAG}-A`, name: "Kho A" } });
    const b = await prisma.warehouse.create({ data: { code: `${TAG}-B`, name: "Kho B" } });
    whA = a.id;
    whB = b.id;
    const p1 = await prisma.product.create({
      data: { sku: `${TAG}-SP1`, name: "SP1", unit: "cái" },
    });
    const p2 = await prisma.product.create({
      data: { sku: `${TAG}-SP2`, name: "SP2", unit: "cái" },
    });
    sp1 = p1.id;
    sp2 = p2.id;

    await inMove(whA, sp1, 10, "100", "a1");
    await inMove(whA, sp1, 20, "130", "a2"); // WAC SP1@A = 120
    await inMove(whA, sp2, 5, "200", "a3");
    await inMove(whB, sp1, 4, "50", "b1");
  });
  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("stockByProduct toàn hệ khớp baseline tính tay", async () => {
    const lines = await InventoryReportService.stockByProduct({}, prisma);
    const mine = lines.filter((l) => l.sku.includes(TAG));

    const s1 = mine.find((l) => l.productId === sp1);
    const s2 = mine.find((l) => l.productId === sp2);
    // SP1: 30@120 (kho A) + 4@50 (kho B) = qty 34, giá trị 3600+200 = 3800
    expect(s1?.quantity).toBe(34);
    expect(s1?.stockValue).toBe("3800.00");
    // SP2: 5@200 = qty 5, giá trị 1000
    expect(s2?.quantity).toBe(5);
    expect(s2?.stockValue).toBe("1000.00");
  });

  it("stockByProduct lọc theo kho A khớp baseline", async () => {
    const lines = await InventoryReportService.stockByProduct({ warehouseId: whA }, prisma);
    const s1 = lines.find((l) => l.productId === sp1);
    const s2 = lines.find((l) => l.productId === sp2);
    expect(s1?.quantity).toBe(30);
    expect(s1?.stockValue).toBe("3600.00");
    expect(s2?.stockValue).toBe("1000.00");
  });

  it("stockByWarehouse khớp baseline (A=4600, B=200)", async () => {
    const lines = await InventoryReportService.stockByWarehouse({}, prisma);
    const a = lines.find((l) => l.warehouseId === whA);
    const b = lines.find((l) => l.warehouseId === whB);
    // A: SP1 3600 + SP2 1000 = 4600, qty 35
    expect(a?.quantity).toBe(35);
    expect(a?.stockValue).toBe("4600.00");
    // B: SP1 200, qty 4
    expect(b?.quantity).toBe(4);
    expect(b?.stockValue).toBe("200.00");
  });

  it("totalStockValue toàn hệ (chỉ dữ liệu test) — kho A + B = 4800", async () => {
    const [a, b] = await Promise.all([
      InventoryReportService.totalStockValue({ warehouseId: whA }, prisma),
      InventoryReportService.totalStockValue({ warehouseId: whB }, prisma),
    ]);
    expect(a).toBe("4600.00");
    expect(b).toBe("200.00");
    // tổng 2 kho test = 4800
    const { Money } = await import("@/domain/money");
    expect(Money.of(a).add(b).toDecimalString()).toBe("4800.00");
  });

  it("bỏ dòng quantity=0 mặc định, includeZero=true thì giữ", async () => {
    // Xuất hết SP2 ở kho A → qty 0
    await InventoryService.recordMovementInTransaction(
      {
        type: MOVEMENT_TYPE.OUT,
        reason: MOVEMENT_REASON.SALES_SHIPMENT,
        productId: sp2,
        warehouseId: whA,
        quantity: 5,
        unitCost: "0",
        referenceType: REFERENCE_TYPE.SALES_ORDER,
        referenceId: `${TAG}-out-sp2`,
      },
      prisma,
    );
    const def = await InventoryReportService.stockByProduct({ warehouseId: whA }, prisma);
    expect(def.find((l) => l.productId === sp2)).toBeUndefined();
    const withZero = await InventoryReportService.stockByProduct(
      { warehouseId: whA, includeZero: true },
      prisma,
    );
    expect(withZero.find((l) => l.productId === sp2)?.quantity).toBe(0);
  });
});

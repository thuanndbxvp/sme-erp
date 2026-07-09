/**
 * Integration test InventoryService.recordMovement (P1-2, invariant C1) — DB THẬT (Neon).
 *
 * Chứng minh AC + C1:
 * - oversell: OUT vượt tồn → throw "Kho không đủ hàng", tồn KHÔNG đổi.
 * - WAC: 2 lần nhập giá khác nhau → avgCost đúng công thức bình quân gia quyền.
 * - idempotent: gọi lại cùng (reference, reason) → không cộng tồn lần 2.
 * - race: 2 OUT đồng thời tổng vượt tồn → chỉ 1 thành công, không âm.
 * Tự skip nếu không có DATABASE_URL.
 */
import { config } from "dotenv";
config();

import { PrismaClient } from "@prisma/client";
import { InventoryService } from "@/services/inventory.service";
import { MOVEMENT_TYPE, MOVEMENT_REASON, REFERENCE_TYPE } from "@/domain/constants";
import { ValidationError } from "@/domain/errors";

const hasDb = !!process.env.DATABASE_URL;
const describeIf = hasDb ? describe : describe.skip;
jest.setTimeout(60_000);

const prisma = new PrismaClient();
const TAG = "__inv_it__";

let warehouseId: string;
let productId: string;

async function freshProduct() {
  const p = await prisma.product.create({
    data: { sku: `${TAG}-${Date.now()}-${Math.round(performance.now())}`, name: "SP kho", unit: "cái" },
  });
  return p.id;
}

async function cleanup() {
  await prisma.inventoryMovement.deleteMany({ where: { referenceId: { contains: TAG } } });
  await prisma.warehouseInventory.deleteMany({ where: { product: { sku: { contains: TAG } } } });
  await prisma.product.deleteMany({ where: { sku: { contains: TAG } } });
  await prisma.warehouse.deleteMany({ where: { code: { contains: TAG } } });
}

async function currentQty(pid: string): Promise<number> {
  const rows = await prisma.warehouseInventory.findMany({
    where: { warehouseId, productId: pid, batchNumber: "" },
  });
  return rows.reduce((s, r) => s + r.quantity, 0);
}

describeIf("InventoryService.recordMovement integration (C1)", () => {
  beforeAll(async () => {
    await cleanup();
    const wh = await prisma.warehouse.create({ data: { code: `${TAG}-WH`, name: "Kho test" } });
    warehouseId = wh.id;
  });
  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });
  beforeEach(async () => {
    productId = await freshProduct();
  });

  it("WAC: nhập 10@100 rồi 20@130 → avgCost = 120.00, tồn = 30", async () => {
    await InventoryService.recordMovementInTransaction(
      {
        type: MOVEMENT_TYPE.IN,
        reason: MOVEMENT_REASON.PURCHASE_RECEIPT,
        productId,
        warehouseId,
        quantity: 10,
        unitCost: "100",
        referenceType: REFERENCE_TYPE.PURCHASE_ORDER,
        referenceId: `${TAG}-po1`,
      },
      prisma,
    );
    await InventoryService.recordMovementInTransaction(
      {
        type: MOVEMENT_TYPE.IN,
        reason: MOVEMENT_REASON.PURCHASE_RECEIPT,
        productId,
        warehouseId,
        quantity: 20,
        unitCost: "130",
        referenceType: REFERENCE_TYPE.PURCHASE_ORDER,
        referenceId: `${TAG}-po2`,
      },
      prisma,
    );

    const row = await prisma.warehouseInventory.findFirstOrThrow({
      where: { warehouseId, productId, batchNumber: "" },
    });
    expect(row.quantity).toBe(30);
    // (10*100 + 20*130) / 30 = 3600/30 = 120.00
    expect(row.avgCost.toString()).toBe("120");
  });

  it("oversell: OUT 5 khi chỉ có 3 → throw, tồn giữ nguyên 3", async () => {
    await InventoryService.recordMovementInTransaction(
      {
        type: MOVEMENT_TYPE.IN,
        reason: MOVEMENT_REASON.PURCHASE_RECEIPT,
        productId,
        warehouseId,
        quantity: 3,
        unitCost: "100",
        referenceType: REFERENCE_TYPE.PURCHASE_ORDER,
        referenceId: `${TAG}-in3`,
      },
      prisma,
    );
    await expect(
      InventoryService.recordMovementInTransaction(
        {
          type: MOVEMENT_TYPE.OUT,
          reason: MOVEMENT_REASON.SALES_SHIPMENT,
          productId,
          warehouseId,
          quantity: 5,
          unitCost: "0",
          referenceType: REFERENCE_TYPE.SALES_ORDER,
          referenceId: `${TAG}-out5`,
        },
        prisma,
      ),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(await currentQty(productId)).toBe(3); // rollback, không đổi
  });

  it("idempotent: gọi lại cùng (reference, reason) không cộng tồn lần 2", async () => {
    const input = {
      type: MOVEMENT_TYPE.IN,
      reason: MOVEMENT_REASON.PURCHASE_RECEIPT,
      productId,
      warehouseId,
      quantity: 7,
      unitCost: "100",
      referenceType: REFERENCE_TYPE.PURCHASE_ORDER,
      referenceId: `${TAG}-idem`,
    } as const;

    const m1 = await InventoryService.recordMovementInTransaction(input, prisma);
    const m2 = await InventoryService.recordMovementInTransaction(input, prisma);

    expect(m2.id).toBe(m1.id); // trả movement cũ
    expect(await currentQty(productId)).toBe(7); // chỉ cộng 1 lần
  });

  it("OUT xuất đúng theo avgCost hiện hành (unitCost movement = avgCost)", async () => {
    await InventoryService.recordMovementInTransaction(
      {
        type: MOVEMENT_TYPE.IN,
        reason: MOVEMENT_REASON.PURCHASE_RECEIPT,
        productId,
        warehouseId,
        quantity: 10,
        unitCost: "150",
        referenceType: REFERENCE_TYPE.PURCHASE_ORDER,
        referenceId: `${TAG}-in150`,
      },
      prisma,
    );
    const out = await InventoryService.recordMovementInTransaction(
      {
        type: MOVEMENT_TYPE.OUT,
        reason: MOVEMENT_REASON.SALES_SHIPMENT,
        productId,
        warehouseId,
        quantity: 4,
        unitCost: "0", // bị bỏ qua cho OUT
        referenceType: REFERENCE_TYPE.SALES_ORDER,
        referenceId: `${TAG}-out4`,
      },
      prisma,
    );
    expect(out.unitCost.toString()).toBe("150");
    expect(out.totalCost.toString()).toBe("600"); // 4 * 150
    expect(await currentQty(productId)).toBe(6);
  });

  it("race: 2 OUT 6 đồng thời khi tồn 10 → chỉ 1 thành công, tồn = 4 (không âm)", async () => {
    await InventoryService.recordMovementInTransaction(
      {
        type: MOVEMENT_TYPE.IN,
        reason: MOVEMENT_REASON.PURCHASE_RECEIPT,
        productId,
        warehouseId,
        quantity: 10,
        unitCost: "100",
        referenceType: REFERENCE_TYPE.PURCHASE_ORDER,
        referenceId: `${TAG}-race-in`,
      },
      prisma,
    );

    const mkOut = (ref: string) =>
      InventoryService.recordMovementInTransaction(
        {
          type: MOVEMENT_TYPE.OUT,
          reason: MOVEMENT_REASON.SALES_SHIPMENT,
          productId,
          warehouseId,
          quantity: 6,
          unitCost: "0",
          referenceType: REFERENCE_TYPE.SALES_ORDER,
          referenceId: ref,
        },
        prisma,
      );

    const results = await Promise.allSettled([
      mkOut(`${TAG}-race-a`),
      mkOut(`${TAG}-race-b`),
    ]);
    const ok = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    expect(ok).toBe(1); // chỉ 1 xuất được (6 <= 10)
    expect(failed).toBe(1); // cái còn lại thiếu hàng (10-6=4 < 6)
    expect(await currentQty(productId)).toBe(4); // không âm, đúng 10-6
  });
});

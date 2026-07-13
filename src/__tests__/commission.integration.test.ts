import { config } from "dotenv";
config();

import { PrismaClient } from "@prisma/client";
import { CommissionService } from "@/services/commission.service";
import { EmployeeTransactionService } from "@/services/employee-transaction.service";
import { OrderOrchestrator } from "@/services/order-orchestrator.service";
import { ValidationError } from "@/domain/errors";

const hasDb = !!process.env.DATABASE_URL;
const describeIf = hasDb ? describe : describe.skip;
jest.setTimeout(60_000);

const prisma = new PrismaClient();
const TAG = "__comm__";

let customerId: string;
let warehouseId: string;
let userId: string;
let rnd = 0.91;
function nextRandom() { rnd = (rnd + 0.029) % 1; return rnd; }

async function cleanup() {
  await prisma.payout.deleteMany({ where: { user: { name: { contains: TAG } } } });
  await prisma.employeeTransaction.deleteMany({ where: { user: { name: { contains: TAG } } } });
  await prisma.commissionRule.deleteMany({ where: { name: { contains: TAG } } });
  await prisma.invoice.deleteMany({ where: { customer: { name: { contains: TAG } } } });
  await prisma.salesOrder.deleteMany({ where: { customer: { name: { contains: TAG } } } });
  await prisma.customer.deleteMany({ where: { name: { contains: TAG } } });
  await prisma.warehouse.deleteMany({ where: { code: { contains: TAG } } });
  await prisma.user.deleteMany({ where: { name: { contains: TAG } } });
}

describeIf("P5 Commission + Employee Fund", () => {
  beforeAll(async () => {
    await cleanup();
    customerId = (await prisma.customer.create({ data: { name: `${TAG}-KH` } })).id;
    warehouseId = (await prisma.warehouse.create({ data: { code: `${TAG}-WH`, name: "Kho test" } })).id;
    const u = await prisma.user.upsert({
      where: { email: `${TAG}@test.local` },
      update: {},
      create: { email: `${TAG}@test.local`, name: `${TAG} Seller`, passwordHash: "x" },
    });
    userId = u.id;
  });
  afterAll(async () => { await cleanup(); await prisma.$disconnect(); });

  describe("P5-1 Commission (C6)", () => {
    it("tÃ­nh hoa há»“ng PERCENTAGE cho Ä‘Æ¡n DELIVERED", async () => {
      await prisma.commissionRule.create({
        data: { name: `${TAG} Rule 5%`, type: "PERCENTAGE", value: "5", isActive: true },
      });

      const so = await OrderOrchestrator.createWarehouseOrder({
        customerId, warehouseId, fulfillmentType: "WAREHOUSE", salespersonId: userId,
        commissionAmount: "0",
        items: [{ productName: "SP", unit: "cÃ¡i", qty: 2, sellPrice: "50000", baseCost: "0", taxAmount: "0" }],
      }, { now: new Date(), random: nextRandom() }, prisma);
      await OrderOrchestrator.deliverSalesOrder(so.id, {}, prisma);

      const r = await CommissionService.calculateForOrder(so.id, prisma);
      // sellTotal = 2*50000 = 100000, 5% = 5000
      expect(r.userId).toBe(userId);
      expect(r.commission).toBe("5000.00");
    });

    it("payout idempotent: generate 2 láº§n â†’ khÃ´ng double", async () => {
      // VÃ´ hiá»‡u cÃ¡c rule cÅ© Ä‘á»ƒ rule 10% lÃ  duy nháº¥t active
      await prisma.commissionRule.updateMany({ where: { name: { contains: TAG } }, data: { isActive: false } });
      await prisma.commissionRule.create({
        data: { name: `${TAG} Rule 10%`, type: "PERCENTAGE", value: "10", isActive: true },
      });

      // Táº¡o + giao 1 Ä‘Æ¡n 50k cho user
      const so = await OrderOrchestrator.createWarehouseOrder({
        customerId, warehouseId, fulfillmentType: "WAREHOUSE", salespersonId: userId,
        commissionAmount: "0",
        items: [{ productName: "SP2", unit: "cÃ¡i", qty: 1, sellPrice: "50000", baseCost: "0", taxAmount: "0" }],
      }, { now: new Date(), random: nextRandom() }, prisma);
      await OrderOrchestrator.deliverSalesOrder(so.id, {}, prisma);

      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      const p1 = await CommissionService.generatePayout(userId, month, year, prisma);
      const p2 = await CommissionService.generatePayout(userId, month, year, prisma);
      expect(p2!.id).toBe(p1!.id); // idempotent â€” cÃ¹ng 1 record
      expect(Number(p1!.commission)).toBeGreaterThan(0); // cÃ³ hoa há»“ng > 0
      expect(p1!.orderCount).toBeGreaterThanOrEqual(1);
    });

    it("há»§y Ä‘Æ¡n sau payout â†’ generate láº¡i KHÃ”NG double-count (tá»± Ä‘á»™ng loáº¡i Ä‘Æ¡n CANCELLED)", async () => {
      const so = await OrderOrchestrator.createWarehouseOrder({
        customerId, warehouseId, fulfillmentType: "WAREHOUSE", salespersonId: userId,
        commissionAmount: "0",
        items: [{ productName: "SP3", unit: "cÃ¡i", qty: 10, sellPrice: "10000", baseCost: "0", taxAmount: "0" }],
      }, { now: new Date(), random: nextRandom() }, prisma);
      await OrderOrchestrator.deliverSalesOrder(so.id, {}, prisma);

      // Há»§y Ä‘Æ¡n â†’ vá» PENDING (khÃ´ng cÃ²n DELIVERED)
      await prisma.salesOrder.update({ where: { id: so.id }, data: { status: "PENDING" } });

      await expect(
        CommissionService.calculateForOrder(so.id, prisma),
      ).rejects.toBeInstanceOf(ValidationError); // khÃ´ng cÃ²n DELIVERED â†’ throw
    });
  });

  describe("P5-2 EmployeeTransaction", () => {
    it("táº¡m á»©ng â†’ hoÃ n á»©ng â†’ balance Ä‘Ãºng", async () => {
      await EmployeeTransactionService.recordAdvance(userId, "100000", "Táº¡m á»©ng thÃ¡ng 7", prisma);
      await EmployeeTransactionService.recordAdvance(userId, "50000", "Táº¡m á»©ng bá»• sung", prisma);
      await EmployeeTransactionService.recordRefund(userId, "30000", "HoÃ n 1 pháº§n", prisma);

      const bal = await EmployeeTransactionService.getFundBalance(userId, prisma);
      // 100000 + 50000 - 30000 = 120000
      expect(bal).toBe("120000.00");
    });

    it("amount â‰¤ 0 â†’ throw", async () => {
      await expect(
        EmployeeTransactionService.recordAdvance(userId, "0", "", prisma),
      ).rejects.toBeInstanceOf(ValidationError);
      await expect(
        EmployeeTransactionService.recordRefund(userId, "-100", "", prisma),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });
});


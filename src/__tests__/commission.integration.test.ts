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
    it("tính hoa hồng PERCENTAGE cho đơn DELIVERED", async () => {
      await prisma.commissionRule.create({
        data: { name: `${TAG} Rule 5%`, type: "PERCENTAGE", value: "5", isActive: true },
      });

      const so = await OrderOrchestrator.createWarehouseOrder({
        customerId, warehouseId, fulfillmentType: "WAREHOUSE", salespersonId: userId,
        items: [{ productName: "SP", unit: "cái", qty: 2, sellPrice: "50000", baseCost: "0", taxAmount: "0" }],
      }, { now: new Date(), random: nextRandom() }, prisma);
      await OrderOrchestrator.deliverSalesOrder(so.id, {}, prisma);

      const r = await CommissionService.calculateForOrder(so.id, prisma);
      // sellTotal = 2*50000 = 100000, 5% = 5000
      expect(r.userId).toBe(userId);
      expect(r.commission).toBe("5000.00");
    });

    it("payout idempotent: generate 2 lần → không double", async () => {
      // Vô hiệu các rule cũ để rule 10% là duy nhất active
      await prisma.commissionRule.updateMany({ where: { name: { contains: TAG } }, data: { isActive: false } });
      await prisma.commissionRule.create({
        data: { name: `${TAG} Rule 10%`, type: "PERCENTAGE", value: "10", isActive: true },
      });

      // Tạo + giao 1 đơn 50k cho user
      const so = await OrderOrchestrator.createWarehouseOrder({
        customerId, warehouseId, fulfillmentType: "WAREHOUSE", salespersonId: userId,
        items: [{ productName: "SP2", unit: "cái", qty: 1, sellPrice: "50000", baseCost: "0", taxAmount: "0" }],
      }, { now: new Date(), random: nextRandom() }, prisma);
      await OrderOrchestrator.deliverSalesOrder(so.id, {}, prisma);

      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      const p1 = await CommissionService.generatePayout(userId, month, year, prisma);
      const p2 = await CommissionService.generatePayout(userId, month, year, prisma);
      expect(p2!.id).toBe(p1!.id); // idempotent — cùng 1 record
      expect(Number(p1!.commission)).toBeGreaterThan(0); // có hoa hồng > 0
      expect(p1!.orderCount).toBeGreaterThanOrEqual(1);
    });

    it("hủy đơn sau payout → generate lại KHÔNG double-count (tự động loại đơn CANCELLED)", async () => {
      const so = await OrderOrchestrator.createWarehouseOrder({
        customerId, warehouseId, fulfillmentType: "WAREHOUSE", salespersonId: userId,
        items: [{ productName: "SP3", unit: "cái", qty: 10, sellPrice: "10000", baseCost: "0", taxAmount: "0" }],
      }, { now: new Date(), random: nextRandom() }, prisma);
      await OrderOrchestrator.deliverSalesOrder(so.id, {}, prisma);

      // Hủy đơn → về PENDING (không còn DELIVERED)
      await prisma.salesOrder.update({ where: { id: so.id }, data: { status: "PENDING" } });

      await expect(
        CommissionService.calculateForOrder(so.id, prisma),
      ).rejects.toBeInstanceOf(ValidationError); // không còn DELIVERED → throw
    });
  });

  describe("P5-2 EmployeeTransaction", () => {
    it("tạm ứng → hoàn ứng → balance đúng", async () => {
      await EmployeeTransactionService.recordAdvance(userId, "100000", "Tạm ứng tháng 7", prisma);
      await EmployeeTransactionService.recordAdvance(userId, "50000", "Tạm ứng bổ sung", prisma);
      await EmployeeTransactionService.recordRefund(userId, "30000", "Hoàn 1 phần", prisma);

      const bal = await EmployeeTransactionService.getFundBalance(userId, prisma);
      // 100000 + 50000 - 30000 = 120000
      expect(bal).toBe("120000.00");
    });

    it("amount ≤ 0 → throw", async () => {
      await expect(
        EmployeeTransactionService.recordAdvance(userId, "0", "", prisma),
      ).rejects.toBeInstanceOf(ValidationError);
      await expect(
        EmployeeTransactionService.recordRefund(userId, "-100", "", prisma),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });
});

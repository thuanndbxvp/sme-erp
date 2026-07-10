import { config } from "dotenv";
config();

import { PrismaClient } from "@prisma/client";
import { ReconciliationService } from "@/services/reconciliation.service";
import { OrderOrchestrator } from "@/services/order-orchestrator.service";
import { PaymentService } from "@/services/payment.service";
import { PAYMENT_DIRECTION } from "@/domain/constants";

const hasDb = !!process.env.DATABASE_URL;
const describeIf = hasDb ? describe : describe.skip;
jest.setTimeout(60_000);

const prisma = new PrismaClient();
const TAG = "__rec__";

let accountId: string;
let customerId: string;
let warehouseId: string;
let rnd = 0.63;
function nextRandom() { rnd = (rnd + 0.019) % 1; return rnd; }

async function cleanup() {
  await prisma.paymentApplication.deleteMany({ where: { payment: { account: { code: { contains: TAG } } } } });
  await prisma.payment.deleteMany({ where: { account: { code: { contains: TAG } } } });
  const tagAccounts = await prisma.account.findMany({ where: { code: { contains: TAG } }, select: { id: true } });
  for (const a of tagAccounts) {
    await prisma.transaction.deleteMany({ where: { accountId: a.id } });
  }
  await prisma.invoice.deleteMany({ where: { customer: { name: { contains: TAG } } } });
  await prisma.salesOrder.deleteMany({ where: { customer: { name: { contains: TAG } } } });
  await prisma.purchaseOrder.deleteMany({ where: { supplier: { name: { contains: TAG } } } });
  await prisma.customer.deleteMany({ where: { name: { contains: TAG } } });
  await prisma.supplier.deleteMany({ where: { name: { contains: TAG } } });
  await prisma.warehouse.deleteMany({ where: { code: { contains: TAG } } });
  await prisma.account.deleteMany({ where: { code: { contains: TAG } } });
}

describeIf("P3-3 Reconciliation (đối soát)", () => {
  beforeAll(async () => {
    await cleanup();
    accountId = (await prisma.account.create({ data: { code: `${TAG}-BANK`, name: "Bank" } })).id;
    customerId = (await prisma.customer.create({ data: { name: `${TAG}-KH` } })).id;
    await prisma.supplier.create({ data: { name: `${TAG}-NCC` } }); // tạo sẵn NCC cho AP test
    warehouseId = (await prisma.warehouse.create({ data: { code: `${TAG}-WH`, name: "Kho" } })).id;
  });
  afterAll(async () => { await cleanup(); await prisma.$disconnect(); });

  it("đối soát N-N: 1 payment áp vào 2 invoice, getPaymentsForOrder khớp", async () => {
    // Tạo 2 SO → 2 AR Invoice
    const so1 = await OrderOrchestrator.createWarehouseOrder(
      { customerId, warehouseId, fulfillmentType: "WAREHOUSE", items: [{ productName: "A", unit: "cái", qty: 1, sellPrice: "100000", baseCost: "0", taxAmount: "0" }] },
      { now: new Date(), random: nextRandom() }, prisma,
    );
    const so2 = await OrderOrchestrator.createWarehouseOrder(
      { customerId, warehouseId, fulfillmentType: "WAREHOUSE", items: [{ productName: "B", unit: "cái", qty: 1, sellPrice: "50000", baseCost: "0", taxAmount: "0" }] },
      { now: new Date(), random: nextRandom() }, prisma,
    );
    const inv1 = await prisma.invoice.findUniqueOrThrow({ where: { salesOrderId: so1.id } });
    const inv2 = await prisma.invoice.findUniqueOrThrow({ where: { salesOrderId: so2.id } });

    // 1 payment 120k áp vào 2 invoice: inv1=80k, inv2=40k
    await PaymentService.recordPayment({
      direction: PAYMENT_DIRECTION.IN, amount: "120000", accountId, customerId,
      applications: [
        { invoiceId: inv1.id, appliedAmount: "80000" },
        { invoiceId: inv2.id, appliedAmount: "40000" },
      ],
    }, prisma);

    // Đối soát: payments cho SO1
    const m1 = await ReconciliationService.getPaymentsForOrder(so1.id, prisma);
    expect(m1).toHaveLength(1);
    expect(m1[0]!.appliedAmount).toBe("80000.00");
    expect(m1[0]!.orderCode).toBe(so1.orderCode);

    // Đối soát: payments cho SO2
    const m2 = await ReconciliationService.getPaymentsForOrder(so2.id, prisma);
    expect(m2).toHaveLength(1);
    expect(m2[0]!.appliedAmount).toBe("40000.00");

    // Cùng 1 paymentId (N-N)
    expect(m1[0]!.paymentId).toBe(m2[0]!.paymentId);
  });

  it("getOutstandingAR: chỉ trả invoice còn balanceDue > 0", async () => {
    // Tạo SO, thanh toán 1 phần
    const so = await OrderOrchestrator.createWarehouseOrder(
      { customerId, warehouseId, fulfillmentType: "WAREHOUSE", items: [{ productName: "C", unit: "cái", qty: 1, sellPrice: "200000", baseCost: "0", taxAmount: "0" }] },
      { now: new Date(), random: nextRandom() }, prisma,
    );
    const inv = await prisma.invoice.findUniqueOrThrow({ where: { salesOrderId: so.id } });
    await PaymentService.recordPayment({
      direction: PAYMENT_DIRECTION.IN, amount: "50000", accountId, customerId,
      applications: [{ invoiceId: inv.id, appliedAmount: "50000" }],
    }, prisma);

    const ar = await ReconciliationService.getOutstandingAR({ customerId }, prisma);
    const match = ar.find((i) => i.invoiceId === inv.id);
    expect(match).toBeDefined();
    expect(match!.balanceDue).toBe("150000.00"); // 200k - 50k
    expect(match!.paidAmount).toBe("50000.00");
  });

  it("verifyNoOverpayments: 0 vi phạm sau các thao tác bình thường", async () => {
    const bad = await ReconciliationService.verifyNoOverpayments(prisma);
    expect(bad).toHaveLength(0);
  });
});

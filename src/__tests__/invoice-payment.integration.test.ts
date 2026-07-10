import { config } from "dotenv";
config();

import { PrismaClient } from "@prisma/client";
import { InvoiceService } from "@/services/invoice.service";
import { PaymentService } from "@/services/payment.service";
import { OrderOrchestrator } from "@/services/order-orchestrator.service";
import { computePaymentStatus } from "@/domain/payment-status";
import { ValidationError } from "@/domain/errors";
import { PAYMENT_DIRECTION } from "@/domain/constants";

const hasDb = !!process.env.DATABASE_URL;
const describeIf = hasDb ? describe : describe.skip;
jest.setTimeout(60_000);

const prisma = new PrismaClient();
const TAG = "__invpay__";

let accountId: string;
let customerId: string;
let warehouseId: string;
let rnd = 0.41;
function nextRandom() { rnd = (rnd + 0.027) % 1; return rnd; }

async function cleanup() {
  // FK order: con trước cha sau
  await prisma.paymentApplication.deleteMany({ where: { payment: { account: { code: { contains: TAG } } } } });
  await prisma.payment.deleteMany({ where: { account: { code: { contains: TAG } } } });
  const tagAccounts = await prisma.account.findMany({ where: { code: { contains: TAG } }, select: { id: true } });
  for (const a of tagAccounts) {
    await prisma.transaction.deleteMany({ where: { accountId: a.id } });
  }
  await prisma.invoice.deleteMany({ where: { customer: { name: { contains: TAG } } } });
  await prisma.salesOrder.deleteMany({ where: { customer: { name: { contains: TAG } } } });
  await prisma.customer.deleteMany({ where: { name: { contains: TAG } } });
  await prisma.warehouse.deleteMany({ where: { code: { contains: TAG } } });
  await prisma.account.deleteMany({ where: { code: { contains: TAG } } });
}

async function seedSO(totalAmount: string): Promise<{ so: { id: string; customerId: string; totalAmount: string }; inv: { id: string } }> {
  return prisma.$transaction(async (tx) => {
    const so = await tx.salesOrder.create({
      data: {
        orderCode: `${TAG}-SO-${Date.now()}-${Math.random().toFixed(3)}`,
        status: "PENDING", paymentStatus: "UNPAID", fulfillmentType: "WAREHOUSE",
        customerId, totalAmount, taxAmount: "0",
      },
    });
    const inv = await InvoiceService.createFromSalesOrder(tx, { id: so.id, customerId: so.customerId, totalAmount: so.totalAmount.toString() }, {});
    return { so: { id: so.id, customerId: so.customerId, totalAmount: so.totalAmount.toString() }, inv };
  });
}

describeIf("P3-2 Invoice + Payment (C3)", () => {
  beforeAll(async () => {
    await cleanup();
    const a = await prisma.account.create({ data: { code: `${TAG}-BANK`, name: "Bank test" } });
    accountId = a.id;
    const c = await prisma.customer.create({ data: { name: `${TAG}-KH` } });
    customerId = c.id;
    const w = await prisma.warehouse.create({ data: { code: `${TAG}-WH`, name: "Kho test" } });
    warehouseId = w.id;
  });
  afterAll(async () => { await cleanup(); await prisma.$disconnect(); });

  it("invoice AR tạo từ SO: OPEN, balanceDue = totalAmount", async () => {
    const r = await seedSO("500000");
    const inv = await InvoiceService.findByIdOrThrow(r.inv.id, prisma);
    expect(inv.type).toBe("AR");
    expect(inv.status).toBe("OPEN");
    expect(inv.balanceDue.toString()).toBe("500000");
  });

  it("thu đủ → PAID, balanceDue=0, order.paymentStatus → PAID", async () => {
    const r = await seedSO("300000");
    await PaymentService.recordPayment({
      direction: PAYMENT_DIRECTION.IN,
      amount: "300000",
      accountId,
      customerId,
      applications: [{ invoiceId: r.inv.id, appliedAmount: "300000" }],
    }, prisma);

    const inv = await InvoiceService.findByIdOrThrow(r.inv.id, prisma);
    expect(inv.status).toBe("PAID");
    expect(inv.paidAmount.toString()).toBe("300000");
    expect(inv.balanceDue.toString()).toBe("0");

    const so = await prisma.salesOrder.findUniqueOrThrow({ where: { id: r.so.id } });
    expect(so.paymentStatus).toBe("PAID"); // DERIVE đúng
  });

  it("thu một phần → PARTIAL, balanceDue đúng", async () => {
    const r = await seedSO("400000");
    await PaymentService.recordPayment({
      direction: PAYMENT_DIRECTION.IN,
      amount: "150000",
      accountId,
      applications: [{ invoiceId: r.inv.id, appliedAmount: "150000" }],
    }, prisma);

    const inv = await InvoiceService.findByIdOrThrow(r.inv.id, prisma);
    expect(inv.status).toBe("PARTIAL");
    expect(inv.paidAmount.toString()).toBe("150000");
    expect(inv.balanceDue.toString()).toBe("250000");

    const so = await prisma.salesOrder.findUniqueOrThrow({ where: { id: r.so.id } });
    expect(so.paymentStatus).toBe("PARTIAL");
  });

  it("chi NCC (AP): EXPENSE giảm balance account", async () => {
    // Đầu tiên nạp tiền vào account
    await prisma.account.update({ where: { id: accountId }, data: { balance: "1000000" } });

    const r = await seedSO("200000"); // dùng SO làm AP test (thực tế AP là PO)
    // Chuyển invoice thành AP thủ công cho test
    await prisma.invoice.update({ where: { id: r.inv.id }, data: { type: "AP", status: "OPEN", balanceDue: "200000", totalAmount: "200000" } });

    await PaymentService.recordPayment({
      direction: PAYMENT_DIRECTION.OUT,
      amount: "200000",
      accountId,
      supplierId: "supplier-test",
      applications: [{ invoiceId: r.inv.id, appliedAmount: "200000" }],
    }, prisma);

    const after = await prisma.account.findUniqueOrThrow({ where: { id: accountId } });
    // 1,000,000 - 200,000 = 800,000
    expect(after.balance.toString()).toBe("800000");
    const inv = await InvoiceService.findByIdOrThrow(r.inv.id, prisma);
    expect(inv.status).toBe("PAID");
  });

  it("balanceDue KHÔNG thể âm — thanh toán vượt bị chặn", async () => {
    const r = await seedSO("100000");
    await expect(
      PaymentService.recordPayment({
        direction: PAYMENT_DIRECTION.IN,
        amount: "150000",
        accountId,
        applications: [{ invoiceId: r.inv.id, appliedAmount: "150000" }],
      }, prisma),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("computePaymentStatus: 0→UNPAID, 1 phần→PARTIAL, đủ→PAID", () => {
    expect(computePaymentStatus("0", "100")).toBe("UNPAID");
    expect(computePaymentStatus("50", "100")).toBe("PARTIAL");
    expect(computePaymentStatus("100", "100")).toBe("PAID");
    expect(computePaymentStatus("1", "100")).toBe("PARTIAL");
  });

  it("tổng áp vào hóa đơn không khớp amount → bị chặn", async () => {
    const r = await seedSO("200000");
    await expect(
      PaymentService.recordPayment({
        direction: PAYMENT_DIRECTION.IN,
        amount: "100000",
        accountId,
        applications: [{ invoiceId: r.inv.id, appliedAmount: "50000" }], // chỉ 50k ≠ 100k
      }, prisma),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("tạo SO WAREHOUSE → tự động có Invoice AR", async () => {
    const so = await OrderOrchestrator.createWarehouseOrder(
      {
        customerId, warehouseId, fulfillmentType: "WAREHOUSE",
        items: [{ productName: "SP", unit: "cái", qty: 1, sellPrice: "50000", baseCost: "0", taxAmount: "0" }],
      },
      { now: new Date(), random: nextRandom() }, prisma,
    );
    const inv = await prisma.invoice.findUnique({ where: { salesOrderId: so.id } });
    expect(inv).not.toBeNull();
    expect(inv!.type).toBe("AR");
    expect(inv!.status).toBe("OPEN");
    expect(inv!.totalAmount.toString()).toBe("50000");
  });

  it("hủy SO → Invoice → CANCELLED, order.paymentStatus → UNPAID", async () => {
    const so = await OrderOrchestrator.createWarehouseOrder(
      {
        customerId, warehouseId, fulfillmentType: "WAREHOUSE",
        items: [{ productName: "SP2", unit: "cái", qty: 1, sellPrice: "30000", baseCost: "0", taxAmount: "0" }],
      },
      { now: new Date(), random: nextRandom() }, prisma,
    );
    // Thanh toán 1 phần trước khi hủy
    const inv = await prisma.invoice.findUniqueOrThrow({ where: { salesOrderId: so.id } });
    await PaymentService.recordPayment({
      direction: PAYMENT_DIRECTION.IN, amount: "10000", accountId, customerId,
      applications: [{ invoiceId: inv.id, appliedAmount: "10000" }],
    }, prisma);

    // Hủy đơn
    await OrderOrchestrator.cancelSalesOrder(so.id, {}, prisma);

    const invAfter = await prisma.invoice.findUniqueOrThrow({ where: { salesOrderId: so.id } });
    expect(invAfter.status).toBe("CANCELLED");
    expect(invAfter.paidAmount.toString()).toBe("0");
    expect(invAfter.balanceDue.toString()).toBe("0");

    const soAfter = await prisma.salesOrder.findUniqueOrThrow({ where: { id: so.id } });
    expect(soAfter.paymentStatus).toBe("UNPAID"); // DERIVE từ Invoice
  });
});

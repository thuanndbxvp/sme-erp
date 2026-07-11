"use server";

import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/authorize";
import { auditLog } from "@/lib/audit";
import { OrderOrchestrator } from "@/services/order-orchestrator.service";
import { PaymentService } from "@/services/payment.service";
import { TransactionService } from "@/services/transaction.service";
import { prisma } from "@/lib/prisma";
import { safeAction } from "@/lib/action-result";
import type { CreateSalesOrderInput, CreateDropshipOrderInput } from "@/lib/validations/order";
import { FULFILLMENT_TYPE, PAYMENT_DIRECTION } from "@/domain/constants";
import { revalidatePath } from "next/cache";

/** Parse payment info from FormData if present */
function parsePayment(data: FormData, prefix: string) {
  const amount = data.get(`${prefix}PaidAmount`) as string;
  if (!amount || Number(amount) <= 0) return null;
  return {
    paidAmount: amount,
    accountId: data.get(`${prefix}AccountId`) as string,
    categoryId: (data.get(`${prefix}CategoryId`) as string) || null,
  };
}

export async function createWarehouseOrder(formData: FormData) {
  const session = await auth();
  await requirePermission(session?.user?.id, "order.create");
  const input: CreateSalesOrderInput = {
    customerId: formData.get("customerId") as string,
    warehouseId: (formData.get("warehouseId") as string) || undefined,
    fulfillmentType: FULFILLMENT_TYPE.WAREHOUSE,
    salespersonId: (formData.get("salespersonId") as string) || undefined,
    saleDate: formData.get("saleDate") ? new Date(formData.get("saleDate") as string) : undefined,
    items: JSON.parse(formData.get("items") as string),
  };
  const salePayment = parsePayment(formData, "sale");

  return safeAction(async () => {
    const so = await OrderOrchestrator.createWarehouseOrder(input, {
      userId: session?.user?.id,
      now: new Date(),
      random: Math.random(),
    });

    // Thanh toán ngay từ KH nếu có
    if (salePayment) {
      const invoice = await prisma.invoice.findUnique({ where: { salesOrderId: so.id } });
      if (invoice) {
        await PaymentService.recordPayment({
          direction: PAYMENT_DIRECTION.IN,
          amount: salePayment.paidAmount,
          accountId: salePayment.accountId,
          customerId: input.customerId,
          applications: [{ invoiceId: invoice.id, appliedAmount: salePayment.paidAmount }],
          description: `Thu tiền đơn bán ${so.orderCode}`,
        });
      }
    }

    revalidatePath("/orders");
    revalidatePath("/cashflow");
    revalidatePath("/debts");
    await auditLog({ action: "CREATE_ORDER", entityType: "SalesOrder", entityId: so.id, userId: session?.user?.id, metadata: { orderCode: so.orderCode, type: "WAREHOUSE" } });
    return { id: so.id, orderCode: so.orderCode };
  });
}

export async function createDropshipOrder(formData: FormData) {
  const session = await auth();
  await requirePermission(session?.user?.id, "order.create");
  const input: CreateDropshipOrderInput = {
    customerId: formData.get("customerId") as string,
    supplierId: formData.get("supplierId") as string,
    salespersonId: (formData.get("salespersonId") as string) || undefined,
    saleDate: formData.get("saleDate") ? new Date(formData.get("saleDate") as string) : undefined,
    items: JSON.parse(formData.get("items") as string),
  };
  const purchasePayment = parsePayment(formData, "purchase");
  const salePayment = parsePayment(formData, "sale");

  return safeAction(async () => {
    const result = await OrderOrchestrator.createDropshipOrder(input, {
      userId: session?.user?.id,
      now: new Date(),
      random: Math.random(),
    });

    // Thanh toán NCC ngay nếu có
    if (purchasePayment) {
      const inv = await prisma.invoice.findUnique({ where: { purchaseOrderId: result.purchaseOrder.id } });
      if (inv) {
        await PaymentService.recordPayment({
          direction: PAYMENT_DIRECTION.OUT,
          amount: purchasePayment.paidAmount,
          accountId: purchasePayment.accountId,
          supplierId: input.supplierId,
          applications: [{ invoiceId: inv.id, appliedAmount: purchasePayment.paidAmount }],
          description: `Chi trả NCC đơn ${result.purchaseOrder.orderCode}`,
        });
      }
    }

    // Thu tiền KH ngay nếu có
    if (salePayment) {
      const inv = await prisma.invoice.findUnique({ where: { salesOrderId: result.salesOrder.id } });
      if (inv) {
        await PaymentService.recordPayment({
          direction: PAYMENT_DIRECTION.IN,
          amount: salePayment.paidAmount,
          accountId: salePayment.accountId,
          customerId: input.customerId,
          applications: [{ invoiceId: inv.id, appliedAmount: salePayment.paidAmount }],
          description: `Thu tiền đơn bán ${result.salesOrder.orderCode}`,
        });
      }
    }

    revalidatePath("/orders");
    revalidatePath("/cashflow");
    revalidatePath("/debts");
    return { id: result.salesOrder.id, orderCode: result.salesOrder.orderCode };
  });
}

export async function deliverOrder(formData: FormData) {
  const session = await auth();
  await requirePermission(session?.user?.id, "order.deliver");
  const id = formData.get("id") as string;
  return safeAction(async () => {
    await OrderOrchestrator.deliverSalesOrder(id);
    revalidatePath("/orders");
    await auditLog({ action: "DELIVER_ORDER", entityType: "SalesOrder", entityId: id, userId: session?.user?.id });
    return { id };
  });
}

export async function cancelOrder(formData: FormData) {
  const session = await auth();
  await requirePermission(session?.user?.id, "order.cancel");
  const id = formData.get("id") as string;
  const type = formData.get("type") as string;
  return safeAction(async () => {
    if (type === "SO") await OrderOrchestrator.cancelSalesOrder(id);
    else await OrderOrchestrator.cancelPurchaseOrder(id);
    revalidatePath("/orders");
    await auditLog({ action: "CANCEL_ORDER", entityType: type === "SO" ? "SalesOrder" : "PurchaseOrder", entityId: id, userId: session?.user?.id });
    return { id };
  });
}

export async function recordPayment(formData: FormData) {
  const session = await auth();
  await requirePermission(session?.user?.id, "debt.pay");
  return safeAction(async () => {
    const applications = JSON.parse(formData.get("applications") as string);
    await PaymentService.recordPayment({
      direction: formData.get("direction") as "IN" | "OUT",
      amount: formData.get("amount") as string,
      accountId: formData.get("accountId") as string,
      customerId: (formData.get("customerId") as string) || null,
      supplierId: (formData.get("supplierId") as string) || null,
      description: (formData.get("description") as string) || null,
      applications,
    });
    revalidatePath("/debts");
    revalidatePath("/cashflow");
    return { ok: true };
  });
}

interface OrderItemInput { productId?: string; productName: string; unit: string; qty: number; buyPrice: string; sellPrice: string; baseCost: string; taxAmount: string; taxRate?: number; purchaseTaxRate?: number }

/** Unified order creation supporting 3 modes: DROPSHIP, WAREHOUSE, IMPORT */
export async function createUnifiedOrder(formData: FormData) {
  const session = await auth();
  await requirePermission(session?.user?.id, "order.create");
  const mode = formData.get("mode") as string;
  const items = JSON.parse(formData.get("items") as string) as OrderItemInput[];

  const purchasePayment = parsePayment(formData, "purchase");
  const salePayment = parsePayment(formData, "sale");

  return safeAction(async () => {
    if (mode === "IMPORT") {
      // Create purchase order (nhập kho)
      const { PurchaseOrderService } = await import("@/services/purchase-order.service");
      const { InvoiceService } = await import("@/services/invoice.service");
      const po = await prisma.$transaction(async (tx) => {
        const _po = await PurchaseOrderService.createInTx(tx, {
          supplierId: formData.get("supplierId") as string,
          warehouseId: formData.get("warehouseId") as string || undefined,
          orderDate: formData.get("purchaseDate") ? new Date(formData.get("purchaseDate") as string) : undefined,
          items: items.map((it: OrderItemInput) => ({ productId: it.productId, productName: it.productName, unit: it.unit, qty: it.qty, buyPrice: it.buyPrice, taxAmount: "0" })),
        }, { userId: session?.user?.id, now: new Date(), random: Math.random() });

        await InvoiceService.createFromPurchaseOrder(tx, {
          id: _po.id,
          supplierId: _po.supplierId,
          totalAmount: _po.totalAmount.toString(),
        }, { now: new Date(), random: Math.random() });

        return _po;
      });

      if (purchasePayment) {
        const inv = await prisma.invoice.findUnique({ where: { purchaseOrderId: po.id } });
        if (inv) await PaymentService.recordPayment({ direction: PAYMENT_DIRECTION.OUT, amount: purchasePayment.paidAmount, accountId: purchasePayment.accountId, supplierId: po.supplierId, applications: [{ invoiceId: inv.id, appliedAmount: purchasePayment.paidAmount }], description: `Chi NCC đơn ${po.orderCode}` });
      }
      revalidatePath("/orders"); revalidatePath("/cashflow");
      return { id: po.id, orderCode: po.orderCode };
    }

    if (mode === "WAREHOUSE") {
      const so = await OrderOrchestrator.createWarehouseOrder({
        customerId: formData.get("customerId") as string,
        warehouseId: formData.get("warehouseId") as string || undefined,
        fulfillmentType: FULFILLMENT_TYPE.WAREHOUSE,
        salespersonId: (formData.get("salespersonId") as string) || undefined,
        saleDate: formData.get("saleDate") ? new Date(formData.get("saleDate") as string) : undefined,
        items: items.map((it: OrderItemInput) => ({ productId: it.productId, productName: it.productName, unit: it.unit, qty: it.qty, sellPrice: it.sellPrice, baseCost: it.baseCost, taxAmount: "0" })),
      }, { userId: session?.user?.id, now: new Date(), random: Math.random() });

      if (salePayment) {
        const inv = await prisma.invoice.findUnique({ where: { salesOrderId: so.id } });
        if (inv) await PaymentService.recordPayment({ direction: PAYMENT_DIRECTION.IN, amount: salePayment.paidAmount, accountId: salePayment.accountId, customerId: so.customerId, applications: [{ invoiceId: inv.id, appliedAmount: salePayment.paidAmount }], description: `Thu KH đơn ${so.orderCode}` });
      }
      revalidatePath("/orders"); revalidatePath("/cashflow"); revalidatePath("/debts");
      return { id: so.id, orderCode: so.orderCode };
    }

    // DROPSHIP (default)
    const result = await OrderOrchestrator.createDropshipOrder({
      customerId: formData.get("customerId") as string,
      supplierId: formData.get("supplierId") as string,
      salespersonId: (formData.get("salespersonId") as string) || undefined,
      saleDate: formData.get("saleDate") ? new Date(formData.get("saleDate") as string) : undefined,
      items: items.map((it: OrderItemInput) => ({ productId: it.productId, productName: it.productName, unit: it.unit, qty: it.qty, buyPrice: it.buyPrice, sellPrice: it.sellPrice, baseCost: it.baseCost, taxAmount: "0" })),
    }, { userId: session?.user?.id, now: new Date(), random: Math.random() });

    if (purchasePayment) {
      const inv = await prisma.invoice.findUnique({ where: { purchaseOrderId: result.purchaseOrder.id } });
      if (inv) await PaymentService.recordPayment({ direction: PAYMENT_DIRECTION.OUT, amount: purchasePayment.paidAmount, accountId: purchasePayment.accountId, supplierId: result.purchaseOrder.supplierId, applications: [{ invoiceId: inv.id, appliedAmount: purchasePayment.paidAmount }], description: `Chi NCC dropship ${result.purchaseOrder.orderCode}` });
    }
    if (salePayment) {
      const inv = await prisma.invoice.findUnique({ where: { salesOrderId: result.salesOrder.id } });
      if (inv) await PaymentService.recordPayment({ direction: PAYMENT_DIRECTION.IN, amount: salePayment.paidAmount, accountId: salePayment.accountId, customerId: result.salesOrder.customerId, applications: [{ invoiceId: inv.id, appliedAmount: salePayment.paidAmount }], description: `Thu KH dropship ${result.salesOrder.orderCode}` });
    }
    revalidatePath("/orders"); revalidatePath("/cashflow"); revalidatePath("/debts");
    return { id: result.salesOrder.id, orderCode: result.salesOrder.orderCode };
  });
}

export async function recordTransaction(formData: FormData) {
  const session = await auth();
  await requirePermission(session?.user?.id, "cashflow.create");
  const categoryId = (formData.get("categoryId") as string) || null;
  return safeAction(async () => {
    await TransactionService.recordTransactionInTransaction({
      type: formData.get("type") as "INCOME" | "EXPENSE",
      amount: formData.get("amount") as string,
      accountId: formData.get("accountId") as string,
      description: (formData.get("description") as string) || null,
    });
    // Nếu có category, map vào cashFlowGroup hoặc ghi note
    if (categoryId) {
      // Category info is used for future cashFlowGroup mapping
      await prisma.$queryRawUnsafe(
        `SELECT "id", "name" FROM "TransactionCategory" WHERE "id" = $1`, categoryId
      );
    }
    revalidatePath("/cashflow");
    return { ok: true };
  });
}

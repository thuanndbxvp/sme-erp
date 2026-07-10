import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { Money } from "@/domain/money";

/**
 * ReconciliationService (P3-3) — đối soát thu/chi ↔ đơn.
 * CHỈ ĐỌC. Xác minh:
 * - Thanh toán khớp với hóa đơn (N-N qua PaymentApplication)
 * - Tổng thu không vượt công nợ (paidAmount ≤ totalAmount)
 * - Công nợ tồn (AR/AP aging)
 */

export interface PaymentMatch {
  paymentId: string;
  paymentDate: Date;
  direction: string;
  amount: string;
  accountCode: string;
  invoiceId: string;
  invoiceNumber: string;
  appliedAmount: string;
  orderCode: string | null;
}

export interface OutstandingItem {
  invoiceId: string;
  invoiceNumber: string;
  type: string;
  status: string;
  totalAmount: string;
  paidAmount: string;
  balanceDue: string;
  partyName: string;
  orderCode: string | null;
}

export class ReconciliationService {
  /** Danh sách thanh toán khớp với 1 đơn hàng cụ thể. */
  static async getPaymentsForOrder(
    orderId: string,
    prisma: PrismaClient = defaultPrisma,
  ): Promise<PaymentMatch[]> {
    const apps = await prisma.paymentApplication.findMany({
      where: {
        invoice: { OR: [{ salesOrderId: orderId }, { purchaseOrderId: orderId }] },
      },
      include: {
        payment: { include: { account: { select: { code: true } } } },
        invoice: {
          include: {
            salesOrder: { select: { orderCode: true } },
            purchaseOrder: { select: { orderCode: true } },
          },
        },
      },
      orderBy: { payment: { date: "asc" } },
    });

    return apps.map((a) => ({
      paymentId: a.paymentId,
      paymentDate: a.payment.date,
      direction: a.payment.direction,
      amount: Money.of(a.payment.amount.toString()).toDecimalString(),
      accountCode: a.payment.account.code,
      invoiceId: a.invoiceId,
      invoiceNumber: a.invoice.invoiceNumber,
      appliedAmount: Money.of(a.appliedAmount.toString()).toDecimalString(),
      orderCode:
        a.invoice.salesOrder?.orderCode ?? a.invoice.purchaseOrder?.orderCode ?? null,
    }));
  }

  /** Công nợ phải thu (AR) còn tồn — balanceDue > 0. */
  static async getOutstandingAR(
    opts: { customerId?: string } = {},
    prisma: PrismaClient = defaultPrisma,
  ): Promise<OutstandingItem[]> {
    const where: Record<string, unknown> = {
      type: "AR",
      status: { not: "CANCELLED" },
      balanceDue: { gt: "0" },
    };
    if (opts.customerId) where.customerId = opts.customerId;

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        customer: { select: { name: true } },
        salesOrder: { select: { orderCode: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return invoices.map((inv) => ({
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      type: inv.type,
      status: inv.status,
      totalAmount: Money.of(inv.totalAmount.toString()).toDecimalString(),
      paidAmount: Money.of(inv.paidAmount.toString()).toDecimalString(),
      balanceDue: Money.of(inv.balanceDue.toString()).toDecimalString(),
      partyName: inv.customer?.name ?? "",
      orderCode: inv.salesOrder?.orderCode ?? null,
    }));
  }

  /** Công nợ phải trả (AP) còn tồn. */
  static async getOutstandingAP(
    opts: { supplierId?: string } = {},
    prisma: PrismaClient = defaultPrisma,
  ): Promise<OutstandingItem[]> {
    const where: Record<string, unknown> = {
      type: "AP",
      status: { not: "CANCELLED" },
      balanceDue: { gt: "0" },
    };
    if (opts.supplierId) where.supplierId = opts.supplierId;

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        supplier: { select: { name: true } },
        purchaseOrder: { select: { orderCode: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return invoices.map((inv) => ({
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      type: inv.type,
      status: inv.status,
      totalAmount: Money.of(inv.totalAmount.toString()).toDecimalString(),
      paidAmount: Money.of(inv.paidAmount.toString()).toDecimalString(),
      balanceDue: Money.of(inv.balanceDue.toString()).toDecimalString(),
      partyName: inv.supplier?.name ?? "",
      orderCode: inv.purchaseOrder?.orderCode ?? null,
    }));
  }

  /**
   * Kiểm tra toàn hệ: không có hóa đơn nào vượt quá paidAmount > totalAmount.
   * Trả về mảng các invoice vi phạm (phải rỗng).
   */
  static async verifyNoOverpayments(
    prisma: PrismaClient = defaultPrisma,
  ): Promise<OutstandingItem[]> {
    const bad = await prisma.$queryRaw<OutstandingItem[]>`
      SELECT
        "id" as "invoiceId",
        "invoiceNumber",
        "type",
        "status",
        "totalAmount"::text as "totalAmount",
        "paidAmount"::text as "paidAmount",
        "balanceDue"::text as "balanceDue",
        '' as "partyName",
        NULL as "orderCode"
      FROM "Invoice"
      WHERE "paidAmount" > "totalAmount"
    `;
    return bad;
  }
}

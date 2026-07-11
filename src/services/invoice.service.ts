import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { Money } from "@/domain/money";
import { NotFoundError, ValidationError } from "@/domain/errors";
import { AuditAndSecurityHelper } from "@/lib/audit";
import { INVOICE_TYPE, INVOICE_STATUS } from "@/domain/constants";
import type { InvoiceStatusValue } from "@/domain/constants";

type TxClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/** Số ngẫu nhiên ngắn cho invoiceNumber. Sinh server-side, không tin client. */
function genInvoiceNumber(prefix: string, now: Date, random: number): string {
  const ms = String(now.getTime() % 100000).padStart(5, "0");
  const rnd = String(Math.floor(random * 1000)).padStart(3, "0");
  return `${prefix}-${ms}${rnd}`;
}

export class InvoiceService {
  /** Tạo hóa đơn AR từ đơn bán. Gọi trong cùng tx với tạo đơn. */
  static async createFromSalesOrder(
    tx: TxClient,
    so: { id: string; customerId: string; totalAmount: string },
    meta: { now?: Date; random?: number } = {},
  ) {
    // [SECURITY] Chặn sửa/tạo hóa đơn vào kỳ đã khóa sổ
    await AuditAndSecurityHelper.assertNotPeriodLocked(new Date());
    const now = meta.now ?? new Date();
    return tx.invoice.create({
      data: {
        invoiceNumber: genInvoiceNumber("AR", now, meta.random ?? 0.5),
        type: INVOICE_TYPE.AR,
        status: INVOICE_STATUS.OPEN,
        customerId: so.customerId,
        salesOrderId: so.id,
        totalAmount: so.totalAmount,
        paidAmount: "0",
        balanceDue: so.totalAmount, // mới tạo = full amount
      },
    });
  }

  /** Tạo hóa đơn AP từ đơn mua. */
  static async createFromPurchaseOrder(
    tx: TxClient,
    po: { id: string; supplierId: string; totalAmount: string },
    meta: { now?: Date; random?: number } = {},
  ) {
    // [SECURITY] Chặn sửa/tạo hóa đơn vào kỳ đã khóa sổ
    await AuditAndSecurityHelper.assertNotPeriodLocked(new Date());
    const now = meta.now ?? new Date();
    return tx.invoice.create({
      data: {
        invoiceNumber: genInvoiceNumber("AP", now, meta.random ?? 0.5),
        type: INVOICE_TYPE.AP,
        status: INVOICE_STATUS.OPEN,
        supplierId: po.supplierId,
        purchaseOrderId: po.id,
        totalAmount: po.totalAmount,
        paidAmount: "0",
        balanceDue: po.totalAmount,
      },
    });
  }

  /** Áp thanh toán vào hóa đơn (C3). FOR UPDATE invoice, cập nhật paidAmount/balanceDue/status. */
  static async applyPayment(
    tx: TxClient,
    invoiceId: string,
    appliedAmount: string,
  ) {
    const locked = await tx.$queryRaw<
      Array<{ id: string; paidAmount: Prisma.Decimal; totalAmount: Prisma.Decimal; balanceDue: Prisma.Decimal }>
    >`SELECT "id","paidAmount","totalAmount","balanceDue" FROM "Invoice" WHERE "id"=${invoiceId} FOR UPDATE`;
    const row = locked[0];
    if (!row) throw new NotFoundError("Hóa đơn", invoiceId);

    const newPaid = Money.of(row.paidAmount.toString()).add(appliedAmount);
    const total = Money.of(row.totalAmount.toString());
    const newBalanceDue = total.sub(newPaid); // totalAmount - newPaidAmount
    if (newBalanceDue.isNegative()) {
      throw new ValidationError(
        `Thanh toán vượt công nợ: ${invoiceId} — còn ${row.balanceDue.toString()}, áp ${Money.of(appliedAmount).toDecimalString()}`,
      );
    }

    // Tính status cho Invoice: OPEN (chưa trả) / PARTIAL (trả 1 phần) / PAID (trả đủ).
    let newStatus: InvoiceStatusValue;
    if (newPaid.isZero()) {
      newStatus = INVOICE_STATUS.OPEN;
    } else if (newPaid.gte(total)) {
      newStatus = INVOICE_STATUS.PAID;
    } else {
      newStatus = INVOICE_STATUS.PARTIAL;
    }

    return tx.invoice.update({
      where: { id: invoiceId },
      data: {
        paidAmount: newPaid.toDecimalString(),
        balanceDue: newBalanceDue.toDecimalString(),
        status: newStatus,
      },
    });
  }

  /** Áp dụng các khoản tạm ứng (chưa cấn trừ hết) vào hóa đơn này */
  static async applyAdvanceToInvoice(
    tx: TxClient,
    invoiceId: string,
    customerId?: string | null,
    supplierId?: string | null,
  ) {
    const payments = await tx.payment.findMany({
      where: {
        customerId: customerId ?? null,
        supplierId: supplierId ?? null,
      },
      include: { applications: true },
    });

    for (const payment of payments) {
      const totalApplied = payment.applications.reduce(
        (sum, a) => sum.add(a.appliedAmount.toString()),
        Money.zero(),
      );
      const amount = Money.of(payment.amount.toString());
      const remaining = amount.sub(totalApplied);
      if (remaining.lte(0)) continue;

      const locked = await tx.$queryRaw<
        Array<{ balanceDue: Prisma.Decimal }>
      >`SELECT "balanceDue" FROM "Invoice" WHERE "id"=${invoiceId} FOR UPDATE`;
      const inv = locked[0];
      if (!inv) continue;

      const balanceDue = Money.of(inv.balanceDue.toString());
      if (balanceDue.lte(0)) break; // Đã trả hết

      const applied = remaining.gt(balanceDue) ? balanceDue : remaining;

      await InvoiceService.applyPayment(tx, invoiceId, applied.toDecimalString());
      await tx.paymentApplication.create({
        data: {
          paymentId: payment.id,
          invoiceId,
          appliedAmount: applied.toDecimalString(),
        },
      });
    }
  }

  /** Hủy hóa đơn. Reset paidAmount, status → CANCELLED, derive order về UNPAID. */
  static async cancel(tx: TxClient, invoiceId: string) {
    // Lock row trước khi update (MODERATE #4)
    await tx.$queryRaw`SELECT "id" FROM "Invoice" WHERE "id"=${invoiceId} FOR UPDATE`;
    const inv = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } });

    // Hoàn tiền nếu đã có thanh toán (CRITICAL #1)
    if (Money.of(inv.paidAmount.toString()).isPositive()) {
      const apps = await tx.paymentApplication.findMany({
        where: { invoiceId },
        include: { payment: true },
      });
      for (const app of apps) {
        const reverseType = app.payment.direction === "IN" ? "EXPENSE" : "INCOME";
        const { TransactionService } = await import("@/services/transaction.service");
        await TransactionService.recordTransaction(tx, {
          type: reverseType,
          amount: app.appliedAmount.toString(),
          accountId: app.payment.accountId,
          description: `Hoàn tiền hủy hóa đơn ${inv.invoiceNumber}`,
          customerId: inv.customerId,
          supplierId: inv.supplierId,
        });
      }
    }

    await tx.invoice.update({
      where: { id: invoiceId },
      data: { status: INVOICE_STATUS.CANCELLED, paidAmount: "0", balanceDue: "0" },
    });
    // Derive order.paymentStatus → UNPAID (không lưu song song 2 nguồn)
    if (inv.salesOrderId) {
      await tx.salesOrder.update({
        where: { id: inv.salesOrderId },
        data: { paymentStatus: "UNPAID" },
      });
    } else if (inv.purchaseOrderId) {
      await tx.purchaseOrder.update({
        where: { id: inv.purchaseOrderId },
        data: { paymentStatus: "UNPAID" },
      });
    }
  }

  static async findByIdOrThrow(id: string, prisma: PrismaClient = defaultPrisma) {
    const found = await prisma.invoice.findUnique({ where: { id } });
    if (!found) throw new NotFoundError("Hóa đơn", id);
    return found;
  }
}

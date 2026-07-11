import type { PrismaClient } from "@prisma/client";
import { InvoiceService } from "@/services/invoice.service";

type TxClient = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/**
 * OrderBillingService — logic tạo/hủy invoice cho đơn hàng.
 * Tách từ OrderOrchestrator.
 */
export class OrderBillingService {
  /** Tạo hóa đơn bán hàng (AR Invoice) cho đơn bán. */
  static async createSalesInvoice(
    tx: TxClient,
    so: { id: string; customerId: string; totalAmount: string },
    meta: { now?: Date; random?: number } = {},
  ) {
    return InvoiceService.createFromSalesOrder(tx, so, meta);
  }

  /** Tạo hóa đơn mua hàng (AP Invoice) cho đơn mua. */
  static async createPurchaseInvoice(
    tx: TxClient,
    po: { id: string; supplierId: string; totalAmount: string },
    meta: { now?: Date; random?: number } = {},
  ) {
    return InvoiceService.createFromPurchaseOrder(tx, po, meta);
  }

  /** Hủy invoice của đơn bán. */
  static async cancelSalesInvoice(tx: TxClient, salesOrderId: string) {
    const invoice = await tx.invoice.findUnique({ where: { salesOrderId } });
    if (invoice && invoice.status !== "CANCELLED") {
      await InvoiceService.cancel(tx, invoice.id);
    }
  }

  /** Hủy invoice của đơn mua. */
  static async cancelPurchaseInvoice(tx: TxClient, purchaseOrderId: string) {
    const invoice = await tx.invoice.findUnique({ where: { purchaseOrderId } });
    if (invoice && invoice.status !== "CANCELLED") {
      await InvoiceService.cancel(tx, invoice.id);
    }
  }
}

import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { SalesOrderService } from "@/services/sales-order.service";
import { PurchaseOrderService } from "@/services/purchase-order.service";
import { FULFILLMENT_TYPE } from "@/domain/constants";
import type {
  CreateSalesOrderInput,
  CreateDropshipOrderInput,
} from "@/lib/validations/order";

/**
 * OrderOrchestrator (invariant C5) — tạo đơn ATOMIC trong 1 prisma.$transaction.
 *
 * - WAREHOUSE: tạo SO đơn thuần (PENDING). Chưa side-effect kho (xuất kho ở P2-3
 *   khi DELIVERED).
 * - DROPSHIP: trong CÙNG 1 transaction → tạo PO trước (ORDERED) → tạo SO link
 *   linkedPurchaseOrderId. Nếu bất kỳ bước nào lỗi → rollback nguyên vẹn cả hai
 *   (không để PO treo, không để SO không link).
 *
 * Lưu ý: side-effect kho/tiền khi giao hàng thuộc P2-3/P3, KHÔNG làm ở đây.
 */

export interface OrchestratorMeta {
  userId?: string;
  now?: Date;
  random?: number;
}

export class OrderOrchestrator {
  /** Tạo đơn bán từ kho (WAREHOUSE). 1 transaction. */
  static async createWarehouseOrder(
    input: CreateSalesOrderInput,
    meta: OrchestratorMeta = {},
    prisma: PrismaClient = defaultPrisma,
  ) {
    // Ép đúng loại — không tin client tự khai DROPSHIP ở luồng này.
    const soInput: CreateSalesOrderInput = {
      ...input,
      fulfillmentType: FULFILLMENT_TYPE.WAREHOUSE,
    };
    return prisma.$transaction((tx) =>
      SalesOrderService.createInTx(tx, soInput, {
        userId: meta.userId,
        now: meta.now,
        random: meta.random,
      }),
    );
  }

  /**
   * Tạo đơn dropship (C5): PO (ORDERED) + SO link, trong 1 transaction.
   * Trả về { salesOrder, purchaseOrder }.
   */
  static async createDropshipOrder(
    input: CreateDropshipOrderInput,
    meta: OrchestratorMeta = {},
    prisma: PrismaClient = defaultPrisma,
  ) {
    const now = meta.now ?? new Date();
    const random = meta.random ?? 0.5;

    return prisma.$transaction(async (tx) => {
      // 1) Tạo PO trước (ORDERED) từ items (giá nhập buyPrice).
      const purchaseOrder = await PurchaseOrderService.createInTx(
        tx,
        {
          supplierId: input.supplierId,
          items: input.items.map((it) => ({
            productId: it.productId,
            productName: it.productName,
            unit: it.unit,
            qty: it.qty,
            buyPrice: it.buyPrice,
            taxAmount: "0",
          })),
          orderDate: input.saleDate,
        },
        { userId: meta.userId, now, random },
      );

      // 2) Tạo SO link linkedPurchaseOrderId (cùng transaction → atomic).
      const salesOrder = await SalesOrderService.createInTx(
        tx,
        {
          customerId: input.customerId,
          fulfillmentType: FULFILLMENT_TYPE.DROPSHIP,
          salespersonId: input.salespersonId,
          saleDate: input.saleDate,
          items: input.items.map((it) => ({
            productId: it.productId,
            productName: it.productName,
            unit: it.unit,
            qty: it.qty,
            sellPrice: it.sellPrice,
            baseCost: it.baseCost,
            taxAmount: it.taxAmount,
          })),
        },
        {
          userId: meta.userId,
          now,
          random: (random + 0.001) % 1, // tránh trùng orderCode với PO cùng ms
          linkedPurchaseOrderId: purchaseOrder.id,
        },
      );

      return { salesOrder, purchaseOrder };
    });
  }
}

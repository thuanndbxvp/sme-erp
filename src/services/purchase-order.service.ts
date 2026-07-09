import type { Prisma, PrismaClient, PurchaseStatus } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { Money } from "@/domain/money";
import { NotFoundError } from "@/domain/errors";
import { assertTransition, PURCHASE_ORDER_TRANSITIONS } from "@/domain/state-machine";
import { generateOrderCode } from "@/domain/order-code";
import { REFERENCE_TYPE } from "@/domain/constants";
import type { CreatePurchaseOrderInput } from "@/lib/validations/order";

/**
 * PurchaseOrderService (P2-1b, invariant C4). Cấu trúc như SalesOrderService:
 * create tính tổng server-side + ghi history; updateStatus FOR UPDATE + assertTransition.
 * CHƯA làm side-effect kho/tiền (P2-3/P2-4).
 */

type TxClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export interface CreatePurchaseOrderMeta {
  userId?: string;
  now?: Date;
  random?: number;
}

export class PurchaseOrderService {
  /**
   * Tạo PO TRONG transaction đang có (tx). Tách khỏi create() để orchestrator
   * (C5) tạo PO dropship cùng transaction với SO. Trả về order (đã include items).
   */
  static async createInTx(
    tx: TxClient,
    input: CreatePurchaseOrderInput,
    meta: CreatePurchaseOrderMeta = {},
  ) {
    const now = meta.now ?? new Date();
    const random = meta.random ?? 0.5;

    let subtotal = Money.zero();
    let taxTotal = Money.zero();
    const items = input.items.map((it) => {
      const buyTotal = Money.of(it.buyPrice).mul(it.qty);
      const tax = Money.of(it.taxAmount);
      subtotal = subtotal.add(buyTotal);
      taxTotal = taxTotal.add(tax);
      return {
        productId: it.productId ?? null,
        productName: it.productName,
        unit: it.unit,
        qty: it.qty,
        buyPrice: Money.of(it.buyPrice).toDecimalString(),
        buyTotal: buyTotal.toDecimalString(),
        taxAmount: tax.toDecimalString(),
      };
    });
    const totalAmount = subtotal.add(taxTotal);

    const order = await tx.purchaseOrder.create({
      data: {
        orderCode: generateOrderCode("PO", now, random),
        status: "ORDERED",
        paymentStatus: "UNPAID",
        supplierId: input.supplierId,
        warehouseId: input.warehouseId ?? null,
        userId: meta.userId ?? null,
        orderDate: input.orderDate ?? now,
        totalAmount: totalAmount.toDecimalString(),
        taxAmount: taxTotal.toDecimalString(),
        items: { create: items },
      },
      include: { items: true },
    });

    await tx.orderStatusHistory.create({
      data: {
        referenceType: REFERENCE_TYPE.PURCHASE_ORDER,
        referenceId: order.id,
        fromStatus: null,
        toStatus: "ORDERED",
        userId: meta.userId ?? null,
        note: "Tạo đơn",
      },
    });

    return order;
  }

  static async create(
    input: CreatePurchaseOrderInput,
    meta: CreatePurchaseOrderMeta = {},
    prisma: PrismaClient = defaultPrisma,
  ) {
    return prisma.$transaction((tx) => PurchaseOrderService.createInTx(tx, input, meta));
  }

  static async findByIdOrThrow(id: string, prisma: PrismaClient = defaultPrisma) {
    const found = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!found) {
      throw new NotFoundError("Đơn mua", id);
    }
    return found;
  }

  static async list(
    opts: { status?: PurchaseStatus; supplierId?: string } = {},
    prisma: PrismaClient = defaultPrisma,
  ) {
    const where: Prisma.PurchaseOrderWhereInput = {};
    if (opts.status) where.status = opts.status;
    if (opts.supplierId) where.supplierId = opts.supplierId;
    return prisma.purchaseOrder.findMany({ where, orderBy: { createdAt: "desc" } });
  }

  static async updateStatus(
    tx: TxClient,
    id: string,
    to: PurchaseStatus,
    meta: { userId?: string; note?: string } = {},
  ) {
    const locked = await tx.$queryRaw<Array<{ id: string; status: PurchaseStatus }>>`
      SELECT "id", "status" FROM "PurchaseOrder" WHERE "id" = ${id} FOR UPDATE
    `;
    const row = locked[0];
    if (!row) {
      throw new NotFoundError("Đơn mua", id);
    }

    assertTransition(PURCHASE_ORDER_TRANSITIONS, row.status, to, "PurchaseOrder");

    await tx.orderStatusHistory.create({
      data: {
        referenceType: REFERENCE_TYPE.PURCHASE_ORDER,
        referenceId: id,
        fromStatus: row.status,
        toStatus: to,
        userId: meta.userId ?? null,
        note: meta.note ?? null,
      },
    });

    return tx.purchaseOrder.update({
      where: { id },
      data: {
        status: to,
        receivedDate: to === "RECEIVED" ? new Date() : undefined,
      },
    });
  }

  static async updateStatusInTransaction(
    id: string,
    to: PurchaseStatus,
    meta: { userId?: string; note?: string } = {},
    prisma: PrismaClient = defaultPrisma,
  ) {
    return prisma.$transaction((tx) => PurchaseOrderService.updateStatus(tx, id, to, meta));
  }
}

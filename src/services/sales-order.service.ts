import type { Prisma, PrismaClient, OrderStatus } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { Money } from "@/domain/money";
import { NotFoundError } from "@/domain/errors";
import { assertTransition, SALES_ORDER_TRANSITIONS } from "@/domain/state-machine";
import { generateOrderCode } from "@/domain/order-code";
import { REFERENCE_TYPE } from "@/domain/constants";
import type { CreateSalesOrderInput } from "@/lib/validations/order";

/**
 * SalesOrderService (P2-1b, invariant C4).
 *
 * - create: TÍNH LẠI thành tiền dòng + tổng đơn trên SERVER từ items (không tin
 *   client). Ghi 1 dòng OrderStatusHistory (from null → PENDING).
 * - updateStatus: SELECT ... FOR UPDATE order row → assertTransition (state machine)
 *   → ghi history → cập nhật status. Transition sai → throw. CHƯA làm side-effect
 *   kho/tiền (để P2-3/P2-4). Chống race: 2 request cùng đổi → chỉ 1 qua, cái sau
 *   thấy status đã đổi và bị state machine chặn.
 */

type TxClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export interface CreateSalesOrderMeta {
  userId?: string;
  now?: Date;
  random?: number;
}

export class SalesOrderService {
  /**
   * Tạo SO TRONG transaction đang có (tx). Tách khỏi create() để orchestrator
   * (C5) gọi cùng transaction với PO dropship. `linkedPurchaseOrderId` chỉ set
   * cho đơn dropship. Tính lại tổng server-side từ items.
   */
  static async createInTx(
    tx: TxClient,
    input: CreateSalesOrderInput,
    meta: CreateSalesOrderMeta & { linkedPurchaseOrderId?: string } = {},
  ) {
    const now = meta.now ?? new Date();
    const random = meta.random ?? 0.5;

    let subtotal = Money.zero();
    let taxTotal = Money.zero();
    const items = input.items.map((it) => {
      const sellTotal = Money.of(it.sellPrice).mul(it.qty);
      const tax = Money.of(it.taxAmount);
      subtotal = subtotal.add(sellTotal);
      taxTotal = taxTotal.add(tax);
      return {
        productId: it.productId ?? null,
        productName: it.productName,
        unit: it.unit,
        qty: it.qty,
        sellPrice: Money.of(it.sellPrice).toDecimalString(),
        sellTotal: sellTotal.toDecimalString(),
        baseCost: Money.of(it.baseCost).toDecimalString(),
        taxAmount: tax.toDecimalString(),
      };
    });
    const totalAmount = subtotal.add(taxTotal);

    const order = await tx.salesOrder.create({
      data: {
        orderCode: generateOrderCode("SO", now, random),
        status: "PENDING",
        paymentStatus: "UNPAID",
        fulfillmentType: input.fulfillmentType,
        customerId: input.customerId,
        warehouseId: input.warehouseId ?? null,
        linkedPurchaseOrderId: meta.linkedPurchaseOrderId ?? null,
        salespersonId: input.salespersonId ?? null,
        userId: meta.userId ?? null,
        saleDate: input.saleDate ?? now,
        totalAmount: totalAmount.toDecimalString(),
        taxAmount: taxTotal.toDecimalString(),
        items: { create: items },
      },
      include: { items: true },
    });

    await tx.orderStatusHistory.create({
      data: {
        referenceType: REFERENCE_TYPE.SALES_ORDER,
        referenceId: order.id,
        fromStatus: null,
        toStatus: "PENDING",
        userId: meta.userId ?? null,
        note: "Tạo đơn",
      },
    });

    return order;
  }

  static async create(
    input: CreateSalesOrderInput,
    meta: CreateSalesOrderMeta = {},
    prisma: PrismaClient = defaultPrisma,
  ) {
    return prisma.$transaction((tx) => SalesOrderService.createInTx(tx, input, meta));
  }

  static async findByIdOrThrow(id: string, prisma: PrismaClient = defaultPrisma) {
    const found = await prisma.salesOrder.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!found) {
      throw new NotFoundError("Đơn bán", id);
    }
    return found;
  }

  static async list(
    opts: { status?: OrderStatus; customerId?: string } = {},
    prisma: PrismaClient = defaultPrisma,
  ) {
    const where: Prisma.SalesOrderWhereInput = {};
    if (opts.status) where.status = opts.status;
    if (opts.customerId) where.customerId = opts.customerId;
    return prisma.salesOrder.findMany({ where, orderBy: { createdAt: "desc" } });
  }

  /**
   * Đổi trạng thái đơn bán (C4). Lock row trước, validate transition, ghi history.
   * Nhận `tx` để orchestrator (P2-2+) gọi trong transaction lớn kèm side-effect.
   */
  static async updateStatus(
    tx: TxClient,
    id: string,
    to: OrderStatus,
    meta: { userId?: string; note?: string } = {},
  ) {
    // SELECT ... FOR UPDATE — khóa row đơn trước khi đọc trạng thái.
    const locked = await tx.$queryRaw<Array<{ id: string; status: OrderStatus }>>`
      SELECT "id", "status" FROM "SalesOrder" WHERE "id" = ${id} FOR UPDATE
    `;
    const row = locked[0];
    if (!row) {
      throw new NotFoundError("Đơn bán", id);
    }

    // State machine: transition sai → throw (không âm thầm bỏ qua).
    assertTransition(SALES_ORDER_TRANSITIONS, row.status, to, "SalesOrder");

    await tx.orderStatusHistory.create({
      data: {
        referenceType: REFERENCE_TYPE.SALES_ORDER,
        referenceId: id,
        fromStatus: row.status,
        toStatus: to,
        userId: meta.userId ?? null,
        note: meta.note ?? null,
      },
    });

    return tx.salesOrder.update({
      where: { id },
      data: {
        status: to,
        deliveredDate: to === "DELIVERED" ? new Date() : undefined,
      },
    });
  }

  /** Helper: mở transaction rồi updateStatus (caller không tự quản tx). */
  static async updateStatusInTransaction(
    id: string,
    to: OrderStatus,
    meta: { userId?: string; note?: string } = {},
    prisma: PrismaClient = defaultPrisma,
  ) {
    return prisma.$transaction((tx) => SalesOrderService.updateStatus(tx, id, to, meta));
  }
}

import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { Money } from "@/domain/money";

/**
 * ReportService (Phase 4) — toàn bộ báo cáo tài chính SME.
 * Phase 1 Enterprise: Dùng SQL Aggregation (SUM, GROUP BY) thay vì fetch all
 * vào RAM rồi loop JS — tránh OOM khi dữ liệu lớn.
 */

// --- P4-1: P&L (SQL Aggregate) ---

export interface ProfitLossLine {
  revenue: string;
  cogs: string;
  grossProfit: string;
  expenses: string;
  netProfit: string;
  orderCount: number;
}

export async function getProfitLoss(
  opts: { from?: Date; to?: Date } = {},
  prisma: PrismaClient = defaultPrisma,
): Promise<ProfitLossLine> {
  // Build date WHERE clause fragments
  const dateClauses: string[] = [];
  const params: unknown[] = [];

  if (opts.from) { dateClauses.push(`o."deliveredDate" >= $${params.length + 1}`); params.push(opts.from); }
  if (opts.to) { dateClauses.push(`o."deliveredDate" <= $${params.length + 1}`); params.push(opts.to); }

  const dateWhere = dateClauses.length ? `AND ${dateClauses.join(" AND ")}` : "";

  // Revenue + COGS from SQL aggregation (single query, DB computes)
  const plResult = await prisma.$queryRawUnsafe<Array<{ revenue: string; cogs: string }>>(
    `SELECT
       COALESCE(SUM(i."sellTotal"), 0)::text as revenue,
       COALESCE(SUM(i."baseCost" * i."qty"), 0)::text as cogs
     FROM "SalesOrderItem" i
     JOIN "SalesOrder" o ON o."id" = i."salesOrderId"
     WHERE o."status" = 'DELIVERED' ${dateWhere}`,
    ...params,
  );

  // Expenses from SQL aggregation
  const expenseParams: unknown[] = [];
  if (opts.from) expenseParams.push(opts.from);
  if (opts.to) expenseParams.push(opts.to);
  const expDateWhere = opts.from || opts.to
    ? `AND (${[opts.from ? `"date" >= $1` : "", opts.to ? `"date" <= $${opts.from ? 2 : 1}` : ""].filter(Boolean).join(" AND ")})`
    : "";

  const expResult = await prisma.$queryRawUnsafe<Array<{ expenses: string }>>(
    `SELECT COALESCE(SUM("amount"), 0)::text as expenses
     FROM "Transaction"
     WHERE "type" = 'EXPENSE' AND "cashFlowGroup" = 'OPERATIONAL' ${expDateWhere}`,
    ...expenseParams,
  );

  const orderCount = await prisma.salesOrder.count({
    where: {
      status: "DELIVERED",
      ...(opts.from || opts.to ? { deliveredDate: { ...(opts.from ? { gte: opts.from } : {}), ...(opts.to ? { lte: opts.to } : {}) } } : {}),
    },
  });

  const rev = Money.of(plResult[0]?.revenue ?? "0");
  const cogs = Money.of(plResult[0]?.cogs ?? "0");
  const gross = rev.sub(cogs);
  const exp = Money.of(expResult[0]?.expenses ?? "0");
  const net = gross.sub(exp);

  return {
    revenue: rev.toDecimalString(),
    cogs: cogs.toDecimalString(),
    grossProfit: gross.toDecimalString(),
    expenses: exp.toDecimalString(),
    netProfit: net.toDecimalString(),
    orderCount,
  };
}

// --- P4-2: Sổ quỹ (SQL Aggregate) ---

export interface CashFlowLine {
  accountId: string;
  code: string;
  name: string;
  totalIncome: string;
  totalExpense: string;
  netFlow: string;
  closingBalance: string;
}

export async function getCashFlow(
  opts: { from?: Date; to?: Date } = {},
  prisma: PrismaClient = defaultPrisma,
): Promise<CashFlowLine[]> {
  const dateWhere = (opts.from || opts.to)
    ? `AND (${[opts.from ? `t."date" >= $2` : "", opts.to ? `t."date" <= $${opts.from ? 3 : 2}` : ""].filter(Boolean).join(" AND ")})`
    : "";
  const params: unknown[] = [];
  if (opts.from) params.push(opts.from);
  if (opts.to) params.push(opts.to);

  // SQL aggregation by account — single query, DB does the heavy lifting
  const rows = await prisma.$queryRawUnsafe<Array<{
    id: string; code: string; name: string; balance: string;
    totalIncome: string; totalExpense: string;
  }>>(
    `SELECT
       a."id", a."code", a."name", a."balance"::text,
       COALESCE(SUM(CASE WHEN t."type" = 'INCOME' THEN t."amount" ELSE 0 END), 0)::text as "totalIncome",
       COALESCE(SUM(CASE WHEN t."type" = 'EXPENSE' THEN t."amount" ELSE 0 END), 0)::text as "totalExpense"
     FROM "Account" a
     LEFT JOIN "Transaction" t ON t."accountId" = a."id"
       ${dateWhere || ""}
     WHERE a."isActive" = true
     GROUP BY a."id", a."code", a."name", a."balance"
     ORDER BY a."code"`,
    ...(opts.from || opts.to ? params : []),
  );

  return rows.map((r) => {
    const income = Money.of(r.totalIncome);
    const expense = Money.of(r.totalExpense);
    return {
      accountId: r.id,
      code: r.code,
      name: r.name,
      totalIncome: income.toDecimalString(),
      totalExpense: expense.toDecimalString(),
      netFlow: income.sub(expense).toDecimalString(),
      closingBalance: Money.of(r.balance).toDecimalString(),
    };
  });
}

// --- P4-3: Công nợ AR/AP ---

export interface ARAPLine {
  invoiceId: string;
  invoiceNumber: string;
  type: string;
  status: string;
  partyName: string;
  totalAmount: string;
  paidAmount: string;
  balanceDue: string;
  orderCode: string | null;
}

export async function getARReport(
  opts: { customerId?: string } = {},
  prisma: PrismaClient = defaultPrisma,
): Promise<ARAPLine[]> {
  const rows = await prisma.invoice.findMany({
    where: { type: "AR", status: { not: "CANCELLED" }, balanceDue: { gt: "0" }, ...(opts.customerId ? { customerId: opts.customerId } : {}) },
    include: { customer: { select: { name: true } }, salesOrder: { select: { orderCode: true } } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(formatARAP);
}

export async function getAPReport(
  opts: { supplierId?: string } = {},
  prisma: PrismaClient = defaultPrisma,
): Promise<ARAPLine[]> {
  const rows = await prisma.invoice.findMany({
    where: { type: "AP", status: { not: "CANCELLED" }, balanceDue: { gt: "0" }, ...(opts.supplierId ? { supplierId: opts.supplierId } : {}) },
    include: { supplier: { select: { name: true } }, purchaseOrder: { select: { orderCode: true } } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(formatARAP);
}

function formatARAP(inv: Record<string, unknown> & { invoiceNumber: string; type: string; status: string; totalAmount: { toString(): string }; paidAmount: { toString(): string }; balanceDue: { toString(): string }; customer?: { name: string } | null; supplier?: { name: string } | null; salesOrder?: { orderCode: string } | null; purchaseOrder?: { orderCode: string } | null }): ARAPLine {
  return {
    invoiceId: inv.id as string,
    invoiceNumber: inv.invoiceNumber,
    type: inv.type,
    status: inv.status,
    partyName: inv.customer?.name ?? inv.supplier?.name ?? "",
    totalAmount: Money.of(inv.totalAmount.toString()).toDecimalString(),
    paidAmount: Money.of(inv.paidAmount.toString()).toDecimalString(),
    balanceDue: Money.of(inv.balanceDue.toString()).toDecimalString(),
    orderCode: inv.salesOrder?.orderCode ?? inv.purchaseOrder?.orderCode ?? null,
  };
}

// --- P4-4: Bán hàng theo NV/SP (SQL Aggregate) ---

export interface SalesByPerson { salespersonId: string | null; revenue: string; profit: string; orderCount: number; }
export interface SalesByProduct { productId: string | null; productName: string; qty: number; revenue: string; profit: string; }
export interface SalesReport { byPerson: SalesByPerson[]; byProduct: SalesByProduct[]; }

export async function getSalesReport(
  opts: { from?: Date; to?: Date } = {},
  prisma: PrismaClient = defaultPrisma,
): Promise<SalesReport> {
  const dateClauses: string[] = [];
  if (opts.from) dateClauses.push(`o."deliveredDate" >= '${opts.from.toISOString()}'`);
  if (opts.to) dateClauses.push(`o."deliveredDate" <= '${opts.to.toISOString()}'`);
  const dateWhere = dateClauses.length ? `AND ${dateClauses.join(" AND ")}` : "";

  // By Person — SQL GROUP BY (tránh load tất cả items vào RAM)
  const byPerson = await prisma.$queryRawUnsafe<Array<{ personId: string | null; revenue: string; profit: string; orderCount: number }>>(
    `SELECT
       o."salespersonId" as "personId",
       COALESCE(SUM(i."sellTotal"), 0)::text as revenue,
       COALESCE(SUM(i."profit"), 0)::text as profit,
       COUNT(DISTINCT o."id")::int as "orderCount"
     FROM "SalesOrder" o
     JOIN "SalesOrderItem" i ON i."salesOrderId" = o."id"
     WHERE o."status" = 'DELIVERED' ${dateWhere}
     GROUP BY o."salespersonId"
     ORDER BY revenue DESC`,
  );

  // By Product — SQL GROUP BY
  const byProduct = await prisma.$queryRawUnsafe<Array<{ productId: string | null; productName: string; qty: number; revenue: string; profit: string }>>(
    `SELECT
       i."productId",
       MAX(i."productName") as "productName",
       SUM(i."qty")::int as qty,
       COALESCE(SUM(i."sellTotal"), 0)::text as revenue,
       COALESCE(SUM(i."profit"), 0)::text as profit
     FROM "SalesOrderItem" i
     JOIN "SalesOrder" o ON o."id" = i."salesOrderId"
     WHERE o."status" = 'DELIVERED' ${dateWhere}
     GROUP BY i."productId"
     ORDER BY revenue DESC`,
  );

  return {
    byPerson: byPerson.map(r => ({
      salespersonId: r.personId,
      revenue: Money.of(r.revenue).toDecimalString(),
      profit: Money.of(r.profit).toDecimalString(),
      orderCount: r.orderCount,
    })),
    byProduct: byProduct.map(r => ({
      productId: r.productId,
      productName: r.productName,
      qty: r.qty,
      revenue: Money.of(r.revenue).toDecimalString(),
      profit: Money.of(r.profit).toDecimalString(),
    })),
  };
}

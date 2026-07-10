import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { Money } from "@/domain/money";
import { TRANSACTION_TYPE } from "@/domain/constants";

/**
 * ReportService (Phase 4) — toàn bộ báo cáo tài chính SME.
 * CHỈ ĐỌC. Nguồn sự thật: SalesOrderItem (profit), Transaction (chi phí),
 * Invoice (công nợ), Account (số dư). Mọi con số qua Money (decimal).
 */

// --- P4-1: P&L ---

export interface ProfitLossLine {
  revenue: string;
  cogs: string;
  grossProfit: string;
  expenses: string;
  netProfit: string;
  orderCount: number;
}

/** P&L từ order đã DELIVERED + Transaction EXPENSE. Lọc theo khoảng ngày (tùy chọn). */
export async function getProfitLoss(
  opts: { from?: Date; to?: Date } = {},
  prisma: PrismaClient = defaultPrisma,
): Promise<ProfitLossLine> {
  const dateFilter: Record<string, Date> = {};
  if (opts.from) dateFilter.gte = opts.from;
  if (opts.to) dateFilter.lte = opts.to;

  const items = await prisma.salesOrderItem.findMany({
    where: {
      salesOrder: {
        status: "DELIVERED",
        ...(Object.keys(dateFilter).length ? { deliveredDate: dateFilter } : {}),
      },
    },
    select: { sellTotal: true, baseCost: true, qty: true },
  });

  let revenue = Money.zero();
  let cogs = Money.zero();
  for (const it of items) {
    revenue = revenue.add(Money.of(it.sellTotal.toString()));
    cogs = cogs.add(Money.of(it.baseCost.toString()).mul(it.qty));
  }
  const grossProfit = revenue.sub(cogs);

  // Chi phí = Transaction EXPENSE (OPERATIONAL)
  const expenseTx = await prisma.transaction.findMany({
    where: {
      type: TRANSACTION_TYPE.EXPENSE,
      cashFlowGroup: "OPERATIONAL",
      ...(opts.from || opts.to
        ? { date: { ...(opts.from ? { gte: opts.from } : {}), ...(opts.to ? { lte: opts.to } : {}) } }
        : {}),
    },
    select: { amount: true },
  });
  let expenses = Money.zero();
  for (const tx of expenseTx) {
    expenses = expenses.add(Money.of(tx.amount.toString()));
  }
  const netProfit = grossProfit.sub(expenses);

  return {
    revenue: revenue.toDecimalString(),
    cogs: cogs.toDecimalString(),
    grossProfit: grossProfit.toDecimalString(),
    expenses: expenses.toDecimalString(),
    netProfit: netProfit.toDecimalString(),
    orderCount: await prisma.salesOrder.count({
      where: { status: "DELIVERED", ...(Object.keys(dateFilter).length ? { deliveredDate: dateFilter } : {}) },
    }),
  };
}

// --- P4-2: Sổ quỹ / Dòng tiền ---

export interface CashFlowLine {
  accountId: string;
  code: string;
  name: string;
  totalIncome: string;
  totalExpense: string;
  netFlow: string;
  closingBalance: string;
}

/** Dòng tiền theo từng tài khoản. Closing = Account.balance (nguồn sự thật). */
export async function getCashFlow(
  opts: { from?: Date; to?: Date } = {},
  prisma: PrismaClient = defaultPrisma,
): Promise<CashFlowLine[]> {
  const accounts = await prisma.account.findMany({
    where: { isActive: true },
    include: { transactions: { where: { ...(opts.from || opts.to ? { date: { ...((opts.from ? { gte: opts.from } : {})), ...((opts.to ? { lte: opts.to } : {})) } } : {}) } } },
  });

  return accounts.map((acc) => {
    let income = Money.zero();
    let expense = Money.zero();
    for (const tx of acc.transactions) {
      if (tx.type === TRANSACTION_TYPE.INCOME) income = income.add(Money.of(tx.amount.toString()));
      else expense = expense.add(Money.of(tx.amount.toString()));
    }
    return {
      accountId: acc.id,
      code: acc.code,
      name: acc.name,
      totalIncome: income.toDecimalString(),
      totalExpense: expense.toDecimalString(),
      netFlow: income.sub(expense).toDecimalString(),
      closingBalance: Money.of(acc.balance.toString()).toDecimalString(),
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

/** Công nợ phải thu (AR) — balanceDue > 0, chưa CANCELLED. */
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

/** Công nợ phải trả (AP) — balanceDue > 0, chưa CANCELLED. */
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

// --- P4-4: Bán hàng theo NV/SP ---

export interface SalesByPerson {
  salespersonId: string | null;
  revenue: string;
  profit: string;
  orderCount: number;
}

export interface SalesByProduct {
  productId: string | null;
  productName: string;
  qty: number;
  revenue: string;
  profit: string;
}

export interface SalesReport {
  byPerson: SalesByPerson[];
  byProduct: SalesByProduct[];
}

/** Bán hàng theo nhân viên và sản phẩm (chỉ đơn DELIVERED). */
export async function getSalesReport(
  opts: { from?: Date; to?: Date } = {},
  prisma: PrismaClient = defaultPrisma,
): Promise<SalesReport> {
  const dateFilter: Record<string, Date> = {};
  if (opts.from) dateFilter.gte = opts.from;
  if (opts.to) dateFilter.lte = opts.to;

  const orders = await prisma.salesOrder.findMany({
    where: { status: "DELIVERED", ...(Object.keys(dateFilter).length ? { deliveredDate: dateFilter } : {}) },
    include: { items: true },
  });

  // By person
  const personMap = new Map<string, SalesByPerson & { revMoney: Money; profMoney: Money }>();
  for (const so of orders) {
    const key = so.salespersonId ?? "__none__";
    const e = personMap.get(key) ?? { salespersonId: so.salespersonId, revenue: "0", profit: "0", orderCount: 0, revMoney: Money.zero(), profMoney: Money.zero() };
    for (const it of so.items) {
      e.revMoney = e.revMoney.add(Money.of(it.sellTotal.toString()));
      e.profMoney = e.profMoney.add(Money.of(it.profit.toString()));
    }
    e.orderCount += 1;
    personMap.set(key, e);
  }
  const byPerson: SalesByPerson[] = [];
  for (const e of personMap.values()) {
    byPerson.push({ salespersonId: e.salespersonId, revenue: e.revMoney.toDecimalString(), profit: e.profMoney.toDecimalString(), orderCount: e.orderCount });
  }
  byPerson.sort((a, b) => Number(Money.of(b.revenue).sub(a.revenue)));

  // By product
  const prodMap = new Map<string, SalesByProduct & { revMoney: Money; profMoney: Money }>();
  for (const so of orders) {
    for (const it of so.items) {
      const key = it.productId ?? it.productName;
      const e = prodMap.get(key) ?? { productId: it.productId, productName: it.productName, qty: 0, revenue: "0", profit: "0", revMoney: Money.zero(), profMoney: Money.zero() };
      e.qty += it.qty;
      e.revMoney = e.revMoney.add(Money.of(it.sellTotal.toString()));
      e.profMoney = e.profMoney.add(Money.of(it.profit.toString()));
      prodMap.set(key, e);
    }
  }
  const byProduct: SalesByProduct[] = [];
  for (const e of prodMap.values()) {
    byProduct.push({ productId: e.productId, productName: e.productName, qty: e.qty, revenue: e.revMoney.toDecimalString(), profit: e.profMoney.toDecimalString() });
  }
  byProduct.sort((a, b) => Number(Money.of(b.revenue).sub(a.revenue)));

  return { byPerson, byProduct };
}

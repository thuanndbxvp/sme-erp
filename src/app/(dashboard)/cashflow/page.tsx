import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { requirePagePermission, hasPermission } from "@/lib/authorize";
import { getDraftPayslip, type DraftPayslip } from "@/app/actions/hr-actions";
import CashflowClient from "./CashflowClient";

export const dynamic = "force-dynamic";

export default async function CashflowPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const session = await auth();
  await requirePagePermission(session?.user?.id, "cashflow.view");
  
  const { period, from, to } = await searchParams;
  let dateFilter: Record<string, Date> | undefined = undefined;
  const now = new Date();
  
  if (period === "today") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    dateFilter = { gte: start };
  } else if (period === "week") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
    dateFilter = { gte: start };
  } else if (period === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    dateFilter = { gte: start };
  } else if (period === "custom" && from && to) {
    dateFilter = { gte: new Date(from as string), lte: new Date(to as string) };
  }

  const [accounts, transactions, categories, recentSales, recentPurchases] = await Promise.all([
    prisma.account.findMany({ orderBy: { code: "asc" } }),
    prisma.transaction.findMany({
      where: dateFilter ? { date: dateFilter } : undefined,
      orderBy: { date: "desc" },
      take: 500,
      include: { account: { select: { code: true, name: true } } }
    }),
    prisma.$queryRawUnsafe<Array<{ id: string; name: string; type: string; parentId: string | null; isActive: boolean }>>(
      `SELECT * FROM "TransactionCategory" ORDER BY "name"`
    ),
    prisma.salesOrder.findMany({ take: 100, orderBy: { createdAt: "desc" }, select: { id: true, orderCode: true } }),
    prisma.purchaseOrder.findMany({ take: 100, orderBy: { createdAt: "desc" }, select: { id: true, orderCode: true } }),
  ]);

  let draftPayslips: DraftPayslip[] = [];
  const canViewHr = await hasPermission(session?.user?.id, "hr.view");
  if (canViewHr) {
    const activeUsers = await prisma.user.findMany({ where: { isActive: true }, select: { id: true } });
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    draftPayslips = await Promise.all(activeUsers.map(u => getDraftPayslip(u.id, currentMonth, currentYear)));
  }

  return <CashflowClient
    accounts={JSON.parse(JSON.stringify(accounts))}
    transactions={JSON.parse(JSON.stringify(transactions))}
    categories={JSON.parse(JSON.stringify(categories))}
    recentSales={JSON.parse(JSON.stringify(recentSales))}
    recentPurchases={JSON.parse(JSON.stringify(recentPurchases))}
    draftPayslips={JSON.parse(JSON.stringify(draftPayslips))}
    currentPeriod={(period as string) || "all"}
    currentFrom={(from as string) || ""}
    currentTo={(to as string) || ""}
  />;
}

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { requirePagePermission } from "@/lib/authorize";

export const dynamic = "force-dynamic";

export default async function CashflowPage() {
  const session = await auth();
  await requirePagePermission(session?.user?.id, "cashflow.view");
  const [accounts, transactions, categories] = await Promise.all([
    prisma.account.findMany({ orderBy: { code: "asc" } }),
    prisma.transaction.findMany({ orderBy: { date: "desc" }, take: 500, include: { account: { select: { code: true, name: true } } } }),
    prisma.$queryRawUnsafe<Array<{ id: string; name: string; type: string; parentId: string | null; isActive: boolean }>>(
      `SELECT * FROM "TransactionCategory" ORDER BY "name"`
    ),
  ]);
  return <CashflowClient accounts={JSON.parse(JSON.stringify(accounts))} transactions={JSON.parse(JSON.stringify(transactions))} categories={JSON.parse(JSON.stringify(categories))} />;
}

import CashflowClient from "./CashflowClient";

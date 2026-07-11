import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function CashflowPage() {
  const [accounts, transactions, categories] = await Promise.all([
    prisma.account.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
    prisma.transaction.findMany({ orderBy: { date: "desc" }, take: 300, include: { account: { select: { code: true, name: true } } } }),
    prisma.$queryRawUnsafe<Array<{ id: string; name: string; parentId: string | null }>>(`SELECT "id", "name", "parentId" FROM "TransactionCategory" WHERE "isActive" = true ORDER BY "name"`),
  ]);
  return <CashflowClient accounts={JSON.parse(JSON.stringify(accounts))} transactions={JSON.parse(JSON.stringify(transactions))} categories={JSON.parse(JSON.stringify(categories))} />;
}

import CashflowClient from "./CashflowClient";

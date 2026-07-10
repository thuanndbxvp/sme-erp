import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function CashflowPage() {
  const [accounts, transactions] = await Promise.all([
    prisma.account.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
    prisma.transaction.findMany({ orderBy: { date: "desc" }, take: 300, include: { account: { select: { code: true, name: true } } } }),
  ]);
  return <CashflowClient accounts={JSON.parse(JSON.stringify(accounts))} transactions={JSON.parse(JSON.stringify(transactions))} />;
}

import CashflowClient from "./CashflowClient";

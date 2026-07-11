import { prisma } from "@/lib/prisma";
import FinanceClient from "./FinanceClient";

export const dynamic = "force-dynamic";

export default async function FinancePage() {
  const [accounts, categories] = await Promise.all([
    prisma.account.findMany({ orderBy: { code: "asc" } }),
    prisma.$queryRawUnsafe<Array<{ id: string; name: string; type: string; parentId: string | null; isActive: boolean }>>(
      `SELECT * FROM "TransactionCategory" ORDER BY "name"`
    ),
  ]);

  return <FinanceClient accounts={JSON.parse(JSON.stringify(accounts))} categories={JSON.parse(JSON.stringify(categories))} />;
}

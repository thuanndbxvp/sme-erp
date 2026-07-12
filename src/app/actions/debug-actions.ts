"use server";
import { prisma } from "@/lib/prisma";
import { TransactionService } from "@/services/transaction.service";

export async function testRecordTransaction() {
  try {
    const account = await prisma.account.findFirst();
    if (!account) return "No account";

    await TransactionService.recordTransactionInTransaction({
      type: "EXPENSE",
      amount: "1",
      accountId: account.id,
      description: "Test",
    });
    return "OK";
  } catch (e: any) {
    return e.message || String(e);
  }
}

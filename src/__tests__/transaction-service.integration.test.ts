import { config } from "dotenv";
config();

import { prisma } from "@/lib/prisma";
import { TransactionService } from "@/services/transaction.service";
import { ValidationError, NotFoundError } from "@/domain/errors";
import { TRANSACTION_TYPE } from "@/domain/constants";

// Neon remote pooler — nới timeout như các integration test khác.
jest.setTimeout(60_000);

// Helper: seed data dùng chung.
async function seedAccount() {
  return prisma.account.upsert({
    where: { code: "TEST_CASH" },
    update: { balance: "0" },
    create: {
      code: "TEST_CASH",
      name: "Quỹ tiền mặt test",
      balance: "0",
    },
  });
}

async function seedAccountWithBalance(initialBalance: string) {
  return prisma.account.upsert({
    where: { code: "TEST_CASH_BALANCE" },
    update: { balance: initialBalance },
    create: {
      code: "TEST_CASH_BALANCE",
      name: "Quỹ tiền mặt test (có số dư)",
      balance: initialBalance,
    },
  });
}

describe("P3-1 TransactionService (C2)", () => {
  // =============================
  // 1. INCOME: balance tăng đúng
  // =============================
  it("INCOME: balance tăng đúng số", async () => {
    const account = await seedAccount();
    const initialBalance = Number(account.balance);

    const result = await TransactionService.recordTransactionInTransaction({
      type: TRANSACTION_TYPE.INCOME,
      amount: "500.00",
      accountId: account.id,
      description: "Thu tiền bán hàng",
    });

    expect(result.type).toBe("INCOME");
    expect(Number(result.amount)).toBe(500);

    // Đọc account sau transaction
    const updated = await prisma.account.findUniqueOrThrow({
      where: { id: account.id },
    });
    expect(Number(updated.balance)).toBe(initialBalance + 500);
  });

  // =============================
  // 2. EXPENSE: balance giảm đúng
  // =============================
  it("EXPENSE: balance giảm đúng số", async () => {
    const account = await seedAccountWithBalance("1000.00");

    await TransactionService.recordTransactionInTransaction({
      type: TRANSACTION_TYPE.EXPENSE,
      amount: "300.00",
      accountId: account.id,
      description: "Chi mua hàng",
    });

    const updated = await prisma.account.findUniqueOrThrow({
      where: { id: account.id },
    });
    expect(Number(updated.balance)).toBe(700.0);
  });

  // =============================
  // 3. EXPENSE vượt số dư bị chặn
  // =============================
  it("EXPENSE vượt số dư → throw (enforceBalanceCheck=true)", async () => {
    const account = await seedAccountWithBalance("100.00");

    await expect(
      TransactionService.recordTransactionInTransaction({
        type: TRANSACTION_TYPE.EXPENSE,
        amount: "200.00",
        accountId: account.id,
        enforceBalanceCheck: true,
        description: "Chi vượt số dư",
      }),
    ).rejects.toThrow(ValidationError);

    // Balance không đổi
    const updated = await prisma.account.findUniqueOrThrow({
      where: { id: account.id },
    });
    expect(Number(updated.balance)).toBe(100.0);
  });

  // =============================
  // 4. EXPENSE vượt số dư nhưng không bật kiểm → OK
  // =============================
  it("EXPENSE vượt số dư nhưng không enforce → thành công (balance âm)", async () => {
    const account = await seedAccountWithBalance("100.00");

    await TransactionService.recordTransactionInTransaction({
      type: TRANSACTION_TYPE.EXPENSE,
      amount: "200.00",
      accountId: account.id,
      enforceBalanceCheck: false,
      description: "Chi vượt số dư nhưng cho phép",
    });

    const updated = await prisma.account.findUniqueOrThrow({
      where: { id: account.id },
    });
    expect(Number(updated.balance)).toBe(-100.0);
  });

  // =============================
  // 5. Amount = 0 → throw
  // =============================
  it("Amount = 0 → throw ValidationError", async () => {
    const account = await seedAccount();

    await expect(
      TransactionService.recordTransactionInTransaction({
        type: TRANSACTION_TYPE.INCOME,
        amount: "0",
        accountId: account.id,
      }),
    ).rejects.toThrow(ValidationError);
  });

  // =============================
  // 6. Amount âm → throw
  // =============================
  it("Amount âm → throw ValidationError", async () => {
    const account = await seedAccount();

    await expect(
      TransactionService.recordTransactionInTransaction({
        type: TRANSACTION_TYPE.INCOME,
        amount: "-50",
        accountId: account.id,
      }),
    ).rejects.toThrow(ValidationError);
  });

  // =============================
  // 7. Account không tồn tại → throw NotFoundError
  // =============================
  it("Account không tồn tại → throw NotFoundError", async () => {
    await expect(
      TransactionService.recordTransactionInTransaction({
        type: TRANSACTION_TYPE.INCOME,
        amount: "100",
        accountId: "nonexistent-account-id",
      }),
    ).rejects.toThrow(NotFoundError);
  });

  // =============================
  // 8. Atomic: account + transaction trong 1 transaction
  // =============================
  it("INCOME + EXPENSE trong 1 tx: cả 2 đều commit", async () => {
    const account = await seedAccount();

    const [tx1, tx2] = await prisma.$transaction(async (tx) => {
      const t1 = await TransactionService.recordTransaction(tx, {
        type: TRANSACTION_TYPE.INCOME,
        amount: "1000",
        accountId: account.id,
      });
      const t2 = await TransactionService.recordTransaction(tx, {
        type: TRANSACTION_TYPE.EXPENSE,
        amount: "400",
        accountId: account.id,
      });
      return [t1, t2];
    });

    expect(tx1.type).toBe("INCOME");
    expect(Number(tx1.amount)).toBe(1000);
    expect(tx2.type).toBe("EXPENSE");
    expect(Number(tx2.amount)).toBe(400);

    const updated = await prisma.account.findUniqueOrThrow({
      where: { id: account.id },
    });
    expect(Number(updated.balance)).toBe(600.0); // 1000 - 400
  });

  // =============================
  // 9. Rollback khi throw trong tx
  // =============================
  it("Transaction rollback khi gặp lỗi", async () => {
    const account = await seedAccount();

    await expect(
      prisma.$transaction(async (tx) => {
        await TransactionService.recordTransaction(tx, {
          type: TRANSACTION_TYPE.INCOME,
          amount: "500",
          accountId: account.id,
        });
        // Throw sau khi đã ghi INCOME → tx rollback
        throw new Error("Lỗi bất ngờ");
      }),
    ).rejects.toThrow("Lỗi bất ngờ");

    // Balance không đổi vì transaction bị rollback
    const updated = await prisma.account.findUniqueOrThrow({
      where: { id: account.id },
    });
    expect(Number(updated.balance)).toBe(0);
  });

  // =============================
  // 10. Sequential 3 INCOME → tổng balance đúng
  // =============================
  it("Sequential 3 INCOME — mỗi lần FOR UPDATE, balance cuối đúng", async () => {
    const account = await seedAccount();

    for (const amt of ["100", "250", "50"]) {
      await TransactionService.recordTransactionInTransaction({
        type: TRANSACTION_TYPE.INCOME,
        amount: amt,
        accountId: account.id,
      });
    }

    const updated = await prisma.account.findUniqueOrThrow({
      where: { id: account.id },
    });
    // 100 + 250 + 50 = 400
    expect(Number(updated.balance)).toBe(400);
  });
});
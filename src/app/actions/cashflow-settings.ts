"use server";

import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/authorize";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

const SYSTEM_ACCOUNTS = ["BANK", "CASH"];
const SYSTEM_CATEGORIES = ["Dòng tiền Kinh doanh", "Dòng tiền Vận hành"];

// ===== ACCOUNT MANAGEMENT =====

export async function createAccount(formData: FormData) {
  const session = await auth();
  await requirePermission(session?.user?.id, "cashflow.account.manage");

  const name = formData.get("name") as string;
  const type = formData.get("type") as "CASH" | "BANK";
  const initialBalance = formData.get("initialBalance") as string || "0";

  await prisma.account.create({
    data: {
      name,
      code: `${type}_${Date.now()}`,
      balance: parseFloat(initialBalance) || 0,
    },
  });

  revalidatePath("/cashflow");
  return { ok: true };
}

export async function updateAccount(accountId: string, formData: FormData) {
  const session = await auth();
  await requirePermission(session?.user?.id, "cashflow.account.manage");

  // Check if system account
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (account && SYSTEM_ACCOUNTS.includes(account.code)) {
    return { ok: false, error: "Không được phép sửa quỹ hệ thống" };
  }

  const name = formData.get("name") as string;

  await prisma.account.update({
    where: { id: accountId },
    data: { name },
  });

  revalidatePath("/cashflow");
  return { ok: true };
}

export async function deleteAccount(accountId: string) {
  const session = await auth();
  await requirePermission(session?.user?.id, "cashflow.account.manage");

  // Check if system account
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (account && SYSTEM_ACCOUNTS.includes(account.code)) {
    return { ok: false, error: "Không được phép xoá quỹ hệ thống" };
  }

  // Check for transactions referencing this account
  const txCount = await prisma.transaction.count({
    where: { accountId },
  });

  if (txCount > 0) {
    return { ok: false, error: `Không thể xóa: Đã có ${txCount} giao dịch tham chiếu đến Quỹ này.` };
  }

  await prisma.account.delete({ where: { id: accountId } });
  revalidatePath("/cashflow");
  return { ok: true };
}

// ===== CATEGORY MANAGEMENT =====

export async function createCategory(formData: FormData) {
  const session = await auth();
  await requirePermission(session?.user?.id, "cashflow.category.manage");

  const name = formData.get("name") as string;
  const parentId = formData.get("parentId") as string || null;
  const direction = formData.get("direction") as "IN" | "OUT" | "ALL";

  await prisma.transactionCategory.create({
    data: {
      name,
      parentId: parentId || null,
      type: direction,
    },
  });

  revalidatePath("/cashflow");
  return { ok: true };
}

export async function updateCategory(categoryId: string, formData: FormData) {
  const session = await auth();
  await requirePermission(session?.user?.id, "cashflow.category.manage");

  // Check if system category
  const category = await prisma.transactionCategory.findUnique({ where: { id: categoryId } });
  if (category && SYSTEM_CATEGORIES.includes(category.name)) {
    return { ok: false, error: "Không được phép sửa phân loại hệ thống" };
  }

  const name = formData.get("name") as string;
  const parentId = formData.get("parentId") as string || null;
  const direction = formData.get("direction") as "IN" | "OUT" | "ALL";

  await prisma.transactionCategory.update({
    where: { id: categoryId },
    data: { name, parentId: parentId || null, type: direction },
  });

  revalidatePath("/cashflow");
  return { ok: true };
}

export async function deleteCategory(categoryId: string) {
  const session = await auth();
  await requirePermission(session?.user?.id, "cashflow.category.manage");

  // Check if system category
  const category = await prisma.transactionCategory.findUnique({ where: { id: categoryId } });
  if (category && SYSTEM_CATEGORIES.includes(category.name)) {
    return { ok: false, error: "Không được phép xoá phân loại hệ thống" };
  }

  // Check for child categories
  const childCount = await prisma.transactionCategory.count({
    where: { parentId: categoryId },
  });

  if (childCount > 0) {
    return { ok: false, error: `Không thể xóa: Còn ${childCount} phân loại con.` };
  }

  await prisma.transactionCategory.delete({ where: { id: categoryId } });
  revalidatePath("/cashflow");
  return { ok: true };
}

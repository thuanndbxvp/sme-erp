import { z } from "zod";
import { nonEmptyString, safeNonEmptyString } from "@/lib/validations/common";

/**
 * Account (quỹ tiền). balance = NGUỒN SỰ THẬT số dư, CHỈ đổi qua Transaction (C2/C3).
 * Vì vậy schema CRUD danh mục KHÔNG có field balance — create luôn balance=0,
 * update không đụng balance. Chống việc "sửa số dư" tùy tiện qua form danh mục.
 */
export const createAccountSchema = z.object({
  code: nonEmptyString,
  name: safeNonEmptyString, // XSS-safe
});

// KHÔNG cho đổi code (định danh ổn định, gắn với Transaction).
export const updateAccountSchema = z.object({
  name: safeNonEmptyString.optional(), // XSS-safe
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;

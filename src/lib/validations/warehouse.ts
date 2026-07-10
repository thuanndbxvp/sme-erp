import { z } from "zod";
import { nonEmptyString, safeNonEmptyString } from "@/lib/validations/common";

export const createWarehouseSchema = z.object({
  code: nonEmptyString,
  name: safeNonEmptyString, // XSS-safe
});

// KHÔNG cho đổi code (định danh nghiệp vụ ổn định, đã dùng ở tồn kho/movement).
export const updateWarehouseSchema = z.object({
  name: safeNonEmptyString.optional(), // XSS-safe
});

export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>;
export type UpdateWarehouseInput = z.infer<typeof updateWarehouseSchema>;

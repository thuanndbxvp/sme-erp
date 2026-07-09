import { z } from "zod";
import { nonEmptyString } from "@/lib/validations/common";

export const createWarehouseSchema = z.object({
  code: nonEmptyString,
  name: nonEmptyString,
});

// KHÔNG cho đổi code (định danh nghiệp vụ ổn định, đã dùng ở tồn kho/movement).
export const updateWarehouseSchema = z.object({
  name: nonEmptyString.optional(),
});

export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>;
export type UpdateWarehouseInput = z.infer<typeof updateWarehouseSchema>;

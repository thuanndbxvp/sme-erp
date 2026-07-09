import { z } from "zod";
import { moneySchema, nonEmptyString } from "@/lib/validations/common";

export const createProductSchema = z.object({
  sku: nonEmptyString,
  name: nonEmptyString,
  unit: nonEmptyString,
  buyPrice: moneySchema.default("0"),
  sellPrice: moneySchema.default("0"),
});

// Update: các field tùy chọn; KHÔNG cho đổi sku (định danh nghiệp vụ ổn định).
export const updateProductSchema = z.object({
  name: nonEmptyString.optional(),
  unit: nonEmptyString.optional(),
  buyPrice: moneySchema.optional(),
  sellPrice: moneySchema.optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

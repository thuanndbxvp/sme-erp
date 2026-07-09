import { z } from "zod";
import { nonEmptyString, optionalPhone, optionalEmail } from "@/lib/validations/common";

export const createSupplierSchema = z.object({
  name: nonEmptyString,
  phone: optionalPhone,
  email: optionalEmail,
});

export const updateSupplierSchema = z.object({
  name: nonEmptyString.optional(),
  phone: optionalPhone,
  email: optionalEmail,
});

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;

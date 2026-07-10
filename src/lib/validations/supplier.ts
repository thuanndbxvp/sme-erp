import { z } from "zod";
import { safeNonEmptyString, optionalPhone, optionalEmail } from "@/lib/validations/common";

export const createSupplierSchema = z.object({
  name: safeNonEmptyString, // XSS-safe
  phone: optionalPhone,
  email: optionalEmail,
});

export const updateSupplierSchema = z.object({
  name: safeNonEmptyString.optional(), // XSS-safe
  phone: optionalPhone,
  email: optionalEmail,
});

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;

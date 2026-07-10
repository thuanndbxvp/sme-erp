import { z } from "zod";
import {
  moneySchema,
  safeNonEmptyString,
  optionalPhone,
  optionalEmail,
} from "@/lib/validations/common";

export const createCustomerSchema = z.object({
  name: safeNonEmptyString, // XSS-safe
  phone: optionalPhone,
  email: optionalEmail,
  creditLimit: moneySchema.default("0"),
});

export const updateCustomerSchema = z.object({
  name: safeNonEmptyString.optional(), // XSS-safe
  phone: optionalPhone,
  email: optionalEmail,
  creditLimit: moneySchema.optional(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

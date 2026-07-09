import { z } from "zod";
import {
  moneySchema,
  nonEmptyString,
  optionalPhone,
  optionalEmail,
} from "@/lib/validations/common";

export const createCustomerSchema = z.object({
  name: nonEmptyString,
  phone: optionalPhone,
  email: optionalEmail,
  creditLimit: moneySchema.default("0"),
});

export const updateCustomerSchema = z.object({
  name: nonEmptyString.optional(),
  phone: optionalPhone,
  email: optionalEmail,
  creditLimit: moneySchema.optional(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

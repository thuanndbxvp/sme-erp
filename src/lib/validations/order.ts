import { z } from "zod";
import { moneySchema, nonEmptyString } from "@/lib/validations/common";
import { FULFILLMENT_TYPE } from "@/domain/constants";

/**
 * Zod cho tạo đơn (P2-1b). KHÔNG nhận totalAmount từ client — server TÍNH LẠI
 * từ items (bài học V2 #3). Chỉ nhận đơn giá + số lượng; thành tiền dòng và tổng
 * đơn do service tính bằng Money.
 */

const qtySchema = z.number().int().positive("Số lượng phải là số nguyên dương");

export const salesOrderItemInput = z.object({
  productId: z.string().min(1).optional(),
  productName: nonEmptyString,
  unit: nonEmptyString,
  qty: qtySchema,
  sellPrice: moneySchema,
  baseCost: moneySchema.default("0"),
  taxAmount: moneySchema.default("0"),
});

export const createSalesOrderSchema = z.object({
  customerId: nonEmptyString,
  warehouseId: z.string().min(1).optional(),
  fulfillmentType: z
    .enum([FULFILLMENT_TYPE.WAREHOUSE, FULFILLMENT_TYPE.DROPSHIP])
    .default(FULFILLMENT_TYPE.WAREHOUSE),
  salespersonId: z.string().min(1).optional(),
  saleDate: z.coerce.date().optional(),
  items: z.array(salesOrderItemInput).min(1, "Đơn phải có ít nhất 1 dòng"),
});

export const purchaseOrderItemInput = z.object({
  productId: z.string().min(1).optional(),
  productName: nonEmptyString,
  unit: nonEmptyString,
  qty: qtySchema,
  buyPrice: moneySchema,
  taxAmount: moneySchema.default("0"),
});

export const createPurchaseOrderSchema = z.object({
  supplierId: nonEmptyString,
  warehouseId: z.string().min(1).optional(),
  orderDate: z.coerce.date().optional(),
  items: z.array(purchaseOrderItemInput).min(1, "Đơn phải có ít nhất 1 dòng"),
});

export type CreateSalesOrderInput = z.infer<typeof createSalesOrderSchema>;
export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;

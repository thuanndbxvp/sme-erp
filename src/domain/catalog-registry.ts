import type { ZodTypeAny } from "zod";
import type { PrismaClient } from "@prisma/client";
import { ProductService } from "@/services/product.service";
import { CustomerService } from "@/services/customer.service";
import { SupplierService } from "@/services/supplier.service";
import { WarehouseService } from "@/services/warehouse.service";
import { AccountService } from "@/services/account.service";
import {
  createProductSchema,
  updateProductSchema,
} from "@/lib/validations/product";
import {
  createCustomerSchema,
  updateCustomerSchema,
} from "@/lib/validations/customer";
import {
  createSupplierSchema,
  updateSupplierSchema,
} from "@/lib/validations/supplier";
import {
  createWarehouseSchema,
  updateWarehouseSchema,
} from "@/lib/validations/warehouse";
import {
  createAccountSchema,
  updateAccountSchema,
} from "@/lib/validations/account";

/**
 * Registry danh mục — 1 nguồn cấu hình cho actions + UI của cả 5 entity.
 * Mỗi entity khai báo: nhãn, permission code, zod schema, service, field hiển thị.
 * Dùng chung để tránh lặp 5 bộ actions/UI.
 */

export const CATALOG_ENTITIES = [
  "product",
  "customer",
  "supplier",
  "warehouse",
  "account",
] as const;
export type CatalogEntity = (typeof CATALOG_ENTITIES)[number];

export function isCatalogEntity(v: string): v is CatalogEntity {
  return (CATALOG_ENTITIES as readonly string[]).includes(v);
}

export type FieldType = "text" | "money";

export interface FieldConfig {
  name: string;
  label: string;
  type: FieldType;
  /** Có hiển thị ở bảng list không. */
  inList: boolean;
  /** Chỉ nhập khi tạo (không sửa được), vd sku/code. */
  createOnly?: boolean;
}

/** Service danh mục có chung chữ ký CRUD (dùng generic input đã validate). */
export interface CatalogService {
  create(input: never, prisma?: PrismaClient): Promise<{ id: string }>;
  update(id: string, input: never, prisma?: PrismaClient): Promise<{ id: string }>;
  deactivate(id: string, prisma?: PrismaClient): Promise<{ id: string }>;
  findByIdOrThrow(id: string, prisma?: PrismaClient): Promise<Record<string, unknown>>;
  list(
    opts?: { includeInactive?: boolean },
    prisma?: PrismaClient,
  ): Promise<Array<Record<string, unknown>>>;
}

export interface CatalogConfig {
  entity: CatalogEntity;
  label: string;
  labelPlural: string;
  permissionRead: string;
  permissionWrite: string;
  createSchema: ZodTypeAny;
  updateSchema: ZodTypeAny;
  service: CatalogService;
  fields: FieldConfig[];
}

const TEXT = (name: string, label: string, opts: Partial<FieldConfig> = {}): FieldConfig => ({
  name,
  label,
  type: "text",
  inList: true,
  ...opts,
});
const MONEY = (name: string, label: string, opts: Partial<FieldConfig> = {}): FieldConfig => ({
  name,
  label,
  type: "money",
  inList: true,
  ...opts,
});

export const CATALOG_REGISTRY: Record<CatalogEntity, CatalogConfig> = {
  product: {
    entity: "product",
    label: "Sản phẩm & Tồn kho",
    labelPlural: "Sản phẩm & Tồn kho",
    permissionRead: "product.read",
    permissionWrite: "product.write",
    createSchema: createProductSchema,
    updateSchema: updateProductSchema,
    service: ProductService as unknown as CatalogService,
    fields: [
      TEXT("sku", "SKU", { createOnly: true }),
      TEXT("name", "Tên"),
      TEXT("unit", "Đơn vị"),
      MONEY("buyPrice", "Giá nhập"),
      MONEY("sellPrice", "Giá bán"),
    ],
  },
  customer: {
    entity: "customer",
    label: "Khách hàng",
    labelPlural: "Khách hàng",
    permissionRead: "customer.read",
    permissionWrite: "customer.write",
    createSchema: createCustomerSchema,
    updateSchema: updateCustomerSchema,
    service: CustomerService as unknown as CatalogService,
    fields: [
      TEXT("name", "Tên"),
      TEXT("phone", "Điện thoại"),
      TEXT("email", "Email"),
      MONEY("creditLimit", "Hạn mức nợ"),
    ],
  },
  supplier: {
    entity: "supplier",
    label: "Nhà cung cấp",
    labelPlural: "Nhà cung cấp",
    permissionRead: "supplier.read",
    permissionWrite: "supplier.write",
    createSchema: createSupplierSchema,
    updateSchema: updateSupplierSchema,
    service: SupplierService as unknown as CatalogService,
    fields: [
      TEXT("name", "Tên"),
      TEXT("phone", "Điện thoại"),
      TEXT("email", "Email"),
    ],
  },
  warehouse: {
    entity: "warehouse",
    label: "Kho",
    labelPlural: "Kho",
    permissionRead: "warehouse.read",
    permissionWrite: "warehouse.write",
    createSchema: createWarehouseSchema,
    updateSchema: updateWarehouseSchema,
    service: WarehouseService as unknown as CatalogService,
    fields: [TEXT("code", "Mã kho", { createOnly: true }), TEXT("name", "Tên")],
  },
  account: {
    entity: "account",
    label: "Tài khoản tiền",
    labelPlural: "Tài khoản tiền",
    permissionRead: "account.read",
    permissionWrite: "account.write",
    createSchema: createAccountSchema,
    updateSchema: updateAccountSchema,
    service: AccountService as unknown as CatalogService,
    // balance KHÔNG có ở đây — chỉ đổi qua Transaction (C2/C3).
    fields: [TEXT("code", "Mã", { createOnly: true }), TEXT("name", "Tên")],
  },
};

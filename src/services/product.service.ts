import type { PrismaClient, Prisma } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { NotFoundError } from "@/domain/errors";
import { mapPrismaError } from "@/services/prisma-errors";
import type { CreateProductInput, UpdateProductInput } from "@/lib/validations/product";

/**
 * ProductService — CRUD danh mục sản phẩm. Nhận input ĐÃ validate qua zod.
 * Soft delete = isActive=false (không xóa cứng, giữ tham chiếu lịch sử).
 */
export class ProductService {
  static async create(input: CreateProductInput, prisma: PrismaClient = defaultPrisma) {
    try {
      return await prisma.product.create({
        data: {
          sku: input.sku,
          name: input.name,
          unit: input.unit,
          buyPrice: input.buyPrice,
          sellPrice: input.sellPrice,
        },
      });
    } catch (err) {
      return mapPrismaError(err, `SKU đã tồn tại: ${input.sku}`);
    }
  }

  static async update(
    id: string,
    input: UpdateProductInput,
    prisma: PrismaClient = defaultPrisma,
  ) {
    await ProductService.findByIdOrThrow(id, prisma);
    // Chỉ set field được cung cấp; sku không đổi (không có trong schema update).
    const data: Prisma.ProductUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.unit !== undefined) data.unit = input.unit;
    if (input.buyPrice !== undefined) data.buyPrice = input.buyPrice;
    if (input.sellPrice !== undefined) data.sellPrice = input.sellPrice;
    return prisma.product.update({ where: { id }, data });
  }

  /** Soft delete. */
  static async deactivate(id: string, prisma: PrismaClient = defaultPrisma) {
    await ProductService.findByIdOrThrow(id, prisma);
    return prisma.product.update({ where: { id }, data: { isActive: false } });
  }

  static async findByIdOrThrow(id: string, prisma: PrismaClient = defaultPrisma) {
    const found = await prisma.product.findUnique({ where: { id } });
    if (!found) {
      throw new NotFoundError("Sản phẩm", id);
    }
    return found;
  }

  /** Danh sách; mặc định chỉ bản ghi active. */
  static async list(
    opts: { includeInactive?: boolean } = {},
    prisma: PrismaClient = defaultPrisma,
  ) {
    return prisma.product.findMany({
      where: opts.includeInactive ? undefined : { isActive: true },
      orderBy: { createdAt: "desc" },
    });
  }
}

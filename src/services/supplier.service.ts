import type { PrismaClient, Prisma } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { NotFoundError } from "@/domain/errors";
import { mapPrismaError } from "@/services/prisma-errors";
import type { CreateSupplierInput, UpdateSupplierInput } from "@/lib/validations/supplier";

/**
 * SupplierService — CRUD nhà cung cấp. Input đã qua zod. Soft delete = isActive=false.
 */
export class SupplierService {
  static async create(input: CreateSupplierInput, prisma: PrismaClient = defaultPrisma) {
    try {
      return await prisma.supplier.create({
        data: {
          name: input.name,
          phone: input.phone ?? null,
          email: input.email ?? null,
        },
      });
    } catch (err) {
      return mapPrismaError(err, "Nhà cung cấp đã tồn tại");
    }
  }

  static async update(
    id: string,
    input: UpdateSupplierInput,
    prisma: PrismaClient = defaultPrisma,
  ) {
    await SupplierService.findByIdOrThrow(id, prisma);
    const data: Prisma.SupplierUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.phone !== undefined) data.phone = input.phone;
    if (input.email !== undefined) data.email = input.email;
    return prisma.supplier.update({ where: { id }, data });
  }

  static async deactivate(id: string, prisma: PrismaClient = defaultPrisma) {
    await SupplierService.findByIdOrThrow(id, prisma);
    return prisma.supplier.update({ where: { id }, data: { isActive: false } });
  }

  static async findByIdOrThrow(id: string, prisma: PrismaClient = defaultPrisma) {
    const found = await prisma.supplier.findUnique({ where: { id } });
    if (!found) {
      throw new NotFoundError("Nhà cung cấp", id);
    }
    return found;
  }

  static async list(
    opts: { includeInactive?: boolean } = {},
    prisma: PrismaClient = defaultPrisma,
  ) {
    return prisma.supplier.findMany({
      where: opts.includeInactive ? undefined : { isActive: true },
      orderBy: { createdAt: "desc" },
    });
  }
}

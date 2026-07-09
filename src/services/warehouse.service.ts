import type { PrismaClient, Prisma } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { NotFoundError } from "@/domain/errors";
import { mapPrismaError } from "@/services/prisma-errors";
import type { CreateWarehouseInput, UpdateWarehouseInput } from "@/lib/validations/warehouse";

/**
 * WarehouseService — CRUD kho. Input đã qua zod. Soft delete = isActive=false.
 * code không đổi sau khi tạo (gắn với tồn kho/movement).
 */
export class WarehouseService {
  static async create(input: CreateWarehouseInput, prisma: PrismaClient = defaultPrisma) {
    try {
      return await prisma.warehouse.create({
        data: { code: input.code, name: input.name },
      });
    } catch (err) {
      return mapPrismaError(err, `Mã kho đã tồn tại: ${input.code}`);
    }
  }

  static async update(
    id: string,
    input: UpdateWarehouseInput,
    prisma: PrismaClient = defaultPrisma,
  ) {
    await WarehouseService.findByIdOrThrow(id, prisma);
    const data: Prisma.WarehouseUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    return prisma.warehouse.update({ where: { id }, data });
  }

  static async deactivate(id: string, prisma: PrismaClient = defaultPrisma) {
    await WarehouseService.findByIdOrThrow(id, prisma);
    return prisma.warehouse.update({ where: { id }, data: { isActive: false } });
  }

  static async findByIdOrThrow(id: string, prisma: PrismaClient = defaultPrisma) {
    const found = await prisma.warehouse.findUnique({ where: { id } });
    if (!found) {
      throw new NotFoundError("Kho", id);
    }
    return found;
  }

  static async list(
    opts: { includeInactive?: boolean } = {},
    prisma: PrismaClient = defaultPrisma,
  ) {
    return prisma.warehouse.findMany({
      where: opts.includeInactive ? undefined : { isActive: true },
      orderBy: { createdAt: "desc" },
    });
  }
}

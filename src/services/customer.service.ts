import type { PrismaClient, Prisma } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { NotFoundError } from "@/domain/errors";
import { mapPrismaError } from "@/services/prisma-errors";
import type { CreateCustomerInput, UpdateCustomerInput } from "@/lib/validations/customer";

/**
 * CustomerService — CRUD khách hàng. Input đã qua zod. Soft delete = isActive=false.
 */
export class CustomerService {
  static async create(input: CreateCustomerInput, prisma: PrismaClient = defaultPrisma) {
    try {
      return await prisma.customer.create({
        data: {
          name: input.name,
          phone: input.phone ?? null,
          email: input.email ?? null,
          creditLimit: input.creditLimit,
        },
      });
    } catch (err) {
      return mapPrismaError(err, "Khách hàng đã tồn tại");
    }
  }

  static async update(
    id: string,
    input: UpdateCustomerInput,
    prisma: PrismaClient = defaultPrisma,
  ) {
    await CustomerService.findByIdOrThrow(id, prisma);
    const data: Prisma.CustomerUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.phone !== undefined) data.phone = input.phone;
    if (input.email !== undefined) data.email = input.email;
    if (input.creditLimit !== undefined) data.creditLimit = input.creditLimit;
    return prisma.customer.update({ where: { id }, data });
  }

  static async deactivate(id: string, prisma: PrismaClient = defaultPrisma) {
    await CustomerService.findByIdOrThrow(id, prisma);
    return prisma.customer.update({ where: { id }, data: { isActive: false } });
  }

  static async findByIdOrThrow(id: string, prisma: PrismaClient = defaultPrisma) {
    const found = await prisma.customer.findUnique({ where: { id } });
    if (!found) {
      throw new NotFoundError("Khách hàng", id);
    }
    return found;
  }

  static async list(
    opts: { includeInactive?: boolean } = {},
    prisma: PrismaClient = defaultPrisma,
  ) {
    return prisma.customer.findMany({
      where: opts.includeInactive ? undefined : { isActive: true },
      orderBy: { createdAt: "desc" },
    });
  }
}

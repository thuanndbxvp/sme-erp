import type { PrismaClient, Prisma } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { NotFoundError } from "@/domain/errors";
import { mapPrismaError } from "@/services/prisma-errors";
import type { CreateAccountInput, UpdateAccountInput } from "@/lib/validations/account";

/**
 * AccountService — CRUD quỹ tiền.
 *
 * INVARIANT (C2/C3): balance là NGUỒN SỰ THẬT số dư tiền, CHỈ đổi qua Transaction.
 * Service danh mục này KHÔNG bao giờ ghi balance — create để DB default (0),
 * update chỉ đổi name. Không mở đường "sửa số dư" qua form danh mục.
 */
export class AccountService {
  static async create(input: CreateAccountInput, prisma: PrismaClient = defaultPrisma) {
    try {
      // Không set balance — dùng default 0 của schema.
      return await prisma.account.create({
        data: { code: input.code, name: input.name },
      });
    } catch (err) {
      return mapPrismaError(err, `Mã tài khoản đã tồn tại: ${input.code}`);
    }
  }

  static async update(
    id: string,
    input: UpdateAccountInput,
    prisma: PrismaClient = defaultPrisma,
  ) {
    await AccountService.findByIdOrThrow(id, prisma);
    // Chỉ name. TUYỆT ĐỐI không đụng balance ở đây.
    const data: Prisma.AccountUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    return prisma.account.update({ where: { id }, data });
  }

  static async deactivate(id: string, prisma: PrismaClient = defaultPrisma) {
    await AccountService.findByIdOrThrow(id, prisma);
    return prisma.account.update({ where: { id }, data: { isActive: false } });
  }

  static async findByIdOrThrow(id: string, prisma: PrismaClient = defaultPrisma) {
    const found = await prisma.account.findUnique({ where: { id } });
    if (!found) {
      throw new NotFoundError("Tài khoản", id);
    }
    return found;
  }

  static async list(
    opts: { includeInactive?: boolean } = {},
    prisma: PrismaClient = defaultPrisma,
  ) {
    return prisma.account.findMany({
      where: opts.includeInactive ? undefined : { isActive: true },
      orderBy: { createdAt: "desc" },
    });
  }
}

import { Prisma } from "@prisma/client";
import { ConflictError } from "@/domain/errors";

/**
 * Chuyển lỗi Prisma sang lỗi domain. Dùng trong service khi ghi.
 * P2002 = vi phạm unique constraint → ConflictError với tên field.
 */
export function mapPrismaError(err: unknown, conflictMessage: string): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    throw new ConflictError(conflictMessage);
  }
  throw err;
}

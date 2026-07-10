import type { Prisma, PrismaClient } from "@prisma/client";
import { logger } from "@/lib/logger";

/**
 * OutboxService (Mục C7) — side-effect bất đồng bộ đáng tin cậy.
 *
 * - getPending dùng `FOR UPDATE SKIP LOCKED` + `lockedUntil` để nhiều worker
 *   không giành cùng 1 event (không xử lý trùng).
 * - Retry backoff theo attempts; dead-letter (status DEAD) sau MAX_ATTEMPTS.
 * - Handler phía consumer phải idempotent (kiểm đã xử lý trước khi làm).
 */

export const OUTBOX_MAX_ATTEMPTS = 5;
const LOCK_DURATION_MS = 60_000; // 1 phút giữ lock khi đang xử lý

export type OutboxStatus = "PENDING" | "PROCESSING" | "DONE" | "DEAD";

type TxClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export interface CreateOutboxInput {
  type: string;
  payload: Prisma.InputJsonValue;
  idempotencyKey?: string;
}

/** Backoff mũ: 1m, 2m, 4m, 8m, ... theo số lần đã thử. */
function backoffMs(attempts: number): number {
  return Math.min(2 ** attempts, 60) * 60_000;
}

export class OutboxService {
  /** Tạo event PENDING. Idempotent theo idempotencyKey (unique) nếu có. */
  static async create(tx: TxClient, input: CreateOutboxInput) {
    if (input.idempotencyKey) {
      const existing = await tx.outboxEvent.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) {
        return existing;
      }
    }
    return tx.outboxEvent.create({
      data: {
        type: input.type,
        payload: input.payload,
        idempotencyKey: input.idempotencyKey ?? null,
        status: "PENDING",
      },
    });
  }

  /**
   * Lấy tối đa `limit` event sẵn sàng xử lý và ĐÁNH DẤU PROCESSING + gia hạn lock,
   * trong 1 transaction dùng FOR UPDATE SKIP LOCKED. Worker khác chạy song song
   * sẽ bỏ qua row đã bị khóa → không double-process.
   *
   * Điều kiện "sẵn sàng": status PENDING (hoặc PROCESSING đã hết lock) và
   * nextRetryAt <= now (hoặc null).
   */
  static async getPending(prisma: PrismaClient, limit: number, now: Date) {
    const lockedUntil = new Date(now.getTime() + LOCK_DURATION_MS);

    return prisma.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "OutboxEvent"
        WHERE (
          ("status" = 'PENDING')
          OR ("status" = 'PROCESSING' AND ("lockedUntil" IS NULL OR "lockedUntil" <= ${now}))
        )
        AND ("nextRetryAt" IS NULL OR "nextRetryAt" <= ${now})
        ORDER BY "createdAt" ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      `;

        if (rows.length === 0) {
          return [];
        }
        const ids = rows.map((r) => r.id);

        await tx.outboxEvent.updateMany({
          where: { id: { in: ids } },
          data: { status: "PROCESSING", lockedUntil },
        });

        return tx.outboxEvent.findMany({ where: { id: { in: ids } } });
      },
      // Remote pooler (Neon): nới thời gian chờ cấp connection + chạy transaction
      // để 2 worker song song trong test SKIP LOCKED không timeout.
      { maxWait: 15_000, timeout: 20_000 },
    );
  }

  /** Đánh dấu xử lý xong. Accepts transaction client for atomicity. */
  static async markDone(tx: TxClient, id: string) {
    return tx.outboxEvent.update({
      where: { id },
      data: { status: "DONE", lockedUntil: null, nextRetryAt: null },
    });
  }

  /**
   * Đánh dấu thất bại 1 lần: tăng attempts, đặt nextRetryAt theo backoff.
   * Vượt MAX_ATTEMPTS → dead-letter (DEAD), thôi retry.
   */
  static async markFailed(prisma: PrismaClient, id: string, now: Date, error?: string) {
    const current = await prisma.outboxEvent.findUniqueOrThrow({ where: { id } });
    const attempts = current.attempts + 1;
    const dead = attempts >= OUTBOX_MAX_ATTEMPTS;

    if (dead) {
      logger.error({ outboxId: id, attempts, error }, "Outbox event dead-lettered");
    }

    return prisma.outboxEvent.update({
      where: { id },
      data: {
        attempts,
        status: dead ? "DEAD" : "PENDING",
        lockedUntil: null,
        nextRetryAt: dead ? null : new Date(now.getTime() + backoffMs(attempts)),
      },
    });
  }
}

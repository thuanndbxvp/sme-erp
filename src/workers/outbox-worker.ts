/**
 * Outbox Worker — Background job processor.
 *
 * Chạy định kỳ (setInterval) để tiêu thụ hàng đợi OutboxEvent.
 * Dùng FOR UPDATE SKIP LOCKED → nhiều worker song song không xử lý trùng.
 *
 * Khởi động: import và gọi startOutboxWorker() từ instrumentation.ts
 * hoặc một entry point riêng (vd: src/workers/index.ts imported in next.config).
 *
 * Mô hình: Lease (lock) → Process → Mark Done/Failed.
 */

import { prisma } from "@/lib/prisma";
import { OutboxService } from "@/services/outbox.service";
import { logger } from "@/lib/logger";

const POLL_INTERVAL_MS = 5_000; // 5 giây
const BATCH_SIZE = 10;

let running = false;

/** Khởi động worker xử lý Outbox định kỳ. */
export function startOutboxWorker() {
  if (running) return;
  running = true;
  logger.info("Outbox worker started — polling every %d ms", POLL_INTERVAL_MS);

  const tick = async () => {
    try {
      const jobs = await OutboxService.getPending(prisma, BATCH_SIZE, new Date());
      if (jobs.length > 0) {
        logger.info({ count: jobs.length }, "Outbox worker processing jobs");
      }
      for (const job of jobs) {
        try {
          await processJob(job.type, job.payload as Record<string, unknown>);
          await OutboxService.markDone(prisma, job.id);
        } catch (err) {
          logger.error({ jobId: job.id, type: job.type, err }, "Outbox job failed");
          await OutboxService.markFailed(prisma, job.id, new Date(), (err as Error).message);
        }
      }
    } catch (err) {
      logger.error({ err }, "Outbox worker tick error");
    }
  };

  // Immediate first tick, then interval
  tick();
  const timer = setInterval(tick, POLL_INTERVAL_MS);

  // Graceful shutdown
  if (typeof process !== "undefined") {
    process.on("SIGTERM", () => { clearInterval(timer); running = false; });
    process.on("SIGINT", () => { clearInterval(timer); running = false; });
  }

  return { stop: () => { clearInterval(timer); running = false; } };
}

// ===== Job type handlers =====

async function processJob(type: string, _payload: Record<string, unknown>) {
  // Handle known async job types here. Extend as needed.
  switch (type) {
    case "DROPSHIP_DELIVERY":
      // Dropship delivery async processing (inventory sync, PO receipt, etc.)
      // payload: { salesOrderId, linkedPurchaseOrderId }
      break;
    case "WAC_RECALC":
      // Recalculate weighted average cost for a product/warehouse
      // payload: { productId, warehouseId }
      break;
    case "SYNC_FINANCE":
      // Periodic financial sync tasks (chốt sổ, đối soát)
      break;
    case "SEND_NOTIFICATION":
      // Send notification to user
      break;
    case "__test_outbox__":
      // Test type (used in integration tests) — no-op
      break;
    default:
      logger.warn({ type }, "Unknown outbox job type — skipping");
  }
}

/**
 * Next.js Instrumentation — khởi động background services khi server start.
 * Chỉ chạy ở Node.js runtime (không chạy ở Edge).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startOutboxWorker } = await import("@/workers/outbox-worker");
    startOutboxWorker();
    process.stdout.write("[Instrumentation] Outbox worker registered\n");
  }
}

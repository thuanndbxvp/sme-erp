/**
 * Integration test OutboxService (P0-5, C7) — CHẠY TRÊN DB THẬT (Neon).
 *
 * Chứng minh hành vi:
 * - getPending dùng FOR UPDATE SKIP LOCKED: 2 lần gọi ĐỒNG THỜI không trả trùng event.
 * - markFailed backoff + dead-letter sau MAX_ATTEMPTS.
 *
 * Tự skip nếu không có DATABASE_URL (CI không DB) — nói thẳng thay vì xanh giả.
 */
import { config } from "dotenv";
config();

import { PrismaClient } from "@prisma/client";
import { OutboxService, OUTBOX_MAX_ATTEMPTS } from "@/services/outbox.service";

const hasDb = !!process.env.DATABASE_URL;
const describeIf = hasDb ? describe : describe.skip;

// Integration test chạm Neon remote — transaction + round-trip mạng, nới timeout.
jest.setTimeout(60_000);

const prisma = new PrismaClient();
const TEST_TYPE = "__test_outbox__";

async function cleanup() {
  await prisma.outboxEvent.deleteMany({ where: { type: TEST_TYPE } });
}

describeIf("OutboxService integration (C7)", () => {
  beforeAll(async () => {
    await cleanup();
  });
  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });
  beforeEach(async () => {
    await cleanup();
  });

  it("create idempotent theo idempotencyKey", async () => {
    const key = `idem-${TEST_TYPE}-1`;
    const a = await OutboxService.create(prisma, {
      type: TEST_TYPE,
      payload: { n: 1 },
      idempotencyKey: key,
    });
    const b = await OutboxService.create(prisma, {
      type: TEST_TYPE,
      payload: { n: 2 },
      idempotencyKey: key,
    });
    expect(b.id).toBe(a.id);
    const count = await prisma.outboxEvent.count({ where: { idempotencyKey: key } });
    expect(count).toBe(1);
  });

  it("SKIP LOCKED: 2 getPending đồng thời KHÔNG trả trùng event", async () => {
    // Tạo 4 event PENDING.
    for (let i = 0; i < 4; i++) {
      await OutboxService.create(prisma, { type: TEST_TYPE, payload: { i } });
    }
    const now = new Date();

    // Gọi song song 2 worker, mỗi worker lấy tối đa 4.
    const [batchA, batchB] = await Promise.all([
      OutboxService.getPending(prisma, 4, now),
      OutboxService.getPending(prisma, 4, now),
    ]);

    const idsA = new Set(batchA.map((e) => e.id));
    const idsB = new Set(batchB.map((e) => e.id));
    const overlap = [...idsA].filter((id) => idsB.has(id));

    expect(overlap).toHaveLength(0); // không event nào bị 2 worker cùng lấy
    expect(idsA.size + idsB.size).toBe(4); // tổng cộng lấy hết 4, không trùng
    // Tất cả đã chuyển PROCESSING
    const processing = await prisma.outboxEvent.count({
      where: { type: TEST_TYPE, status: "PROCESSING" },
    });
    expect(processing).toBe(4);
  });

  it("markDone chuyển DONE", async () => {
    const e = await OutboxService.create(prisma, { type: TEST_TYPE, payload: {} });
    await OutboxService.markDone(prisma, e.id);
    const after = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: e.id } });
    expect(after.status).toBe("DONE");
  });

  it("markFailed backoff rồi dead-letter sau MAX_ATTEMPTS", async () => {
    const e = await OutboxService.create(prisma, { type: TEST_TYPE, payload: {} });
    const now = new Date();

    // Fail (MAX-1) lần → vẫn PENDING, có nextRetryAt.
    for (let i = 0; i < OUTBOX_MAX_ATTEMPTS - 1; i++) {
      await OutboxService.markFailed(prisma, e.id, now, "boom");
    }
    let row = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: e.id } });
    expect(row.status).toBe("PENDING");
    expect(row.attempts).toBe(OUTBOX_MAX_ATTEMPTS - 1);
    expect(row.nextRetryAt).not.toBeNull();

    // Fail thêm 1 lần → DEAD.
    await OutboxService.markFailed(prisma, e.id, now, "boom");
    row = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: e.id } });
    expect(row.status).toBe("DEAD");
    expect(row.attempts).toBe(OUTBOX_MAX_ATTEMPTS);
    expect(row.nextRetryAt).toBeNull();
  });

  it("getPending bỏ qua event có nextRetryAt trong tương lai", async () => {
    const e = await OutboxService.create(prisma, { type: TEST_TYPE, payload: {} });
    const future = new Date(Date.now() + 3_600_000);
    await prisma.outboxEvent.update({
      where: { id: e.id },
      data: { nextRetryAt: future },
    });
    const batch = await OutboxService.getPending(prisma, 10, new Date());
    expect(batch.find((x) => x.id === e.id)).toBeUndefined();
  });
});

/**
 * Smoke test P0-1: chứng minh hạ tầng Jest + ts-jest + alias @/ hoạt động.
 * Các task sau thay bằng test hành vi thật.
 */
import { logger } from "@/lib/logger";

describe("P0-1 infra smoke", () => {
  it("resolves @/ path alias and imports logger", () => {
    expect(typeof logger.info).toBe("function");
  });

  it("runs basic assertions", () => {
    expect(1 + 1).toBe(2);
  });
});

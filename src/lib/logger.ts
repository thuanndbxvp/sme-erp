import pino from "pino";

/**
 * Logger chuẩn toàn hệ. CẤM dùng `console.*` trong code sản phẩm (Mục A).
 * Không ghi file trong request — chỉ stream ra stdout, hạ tầng thu log.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
});

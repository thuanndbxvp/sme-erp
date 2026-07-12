import { ZodError } from "zod";
import { ConflictError, NotFoundError, ValidationError } from "@/domain/errors";
import { ForbiddenError, UnauthorizedError } from "@/services/rbac.service";
import { logger } from "@/lib/logger";

/**
 * Kết quả trả về từ server action cho UI. KHÔNG throw qua ranh giới RSC —
 * bọc lỗi domain thành dữ liệu để form hiển thị.
 */
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export function success<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function failure(error: string, fieldErrors?: Record<string, string>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

/**
 * Bọc thân action: chạy fn, chuyển các lỗi đã biết thành ActionResult.
 * - ZodError → fieldErrors để form đánh dấu từng field.
 * - Conflict/Validation/NotFound/Forbidden/Unauthorized → message thân thiện.
 * - Lỗi lạ → log (không lộ chi tiết cho client) + message chung.
 */
export async function safeAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return success(await fn());
  } catch (err) {
    if (err instanceof ZodError) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of err.issues) {
        const key = issue.path.join(".") || "_";
        if (!fieldErrors[key]) {
          fieldErrors[key] = issue.message;
        }
      }
      return failure("Dữ liệu không hợp lệ", fieldErrors);
    }
    if (err instanceof UnauthorizedError) {
      return failure("Bạn cần đăng nhập");
    }
    if (err instanceof ForbiddenError) {
      return failure("Bạn không có quyền thực hiện thao tác này");
    }
    if (
      err instanceof ConflictError ||
      err instanceof ValidationError ||
      err instanceof NotFoundError
    ) {
      return failure(err.message);
    }
    logger.error({ err }, "Lỗi không xác định trong server action");
    return failure(err instanceof Error ? err.message : "Có lỗi xảy ra, vui lòng thử lại");
  }
}

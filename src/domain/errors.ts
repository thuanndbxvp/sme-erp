/**
 * Lỗi domain dùng chung cho service layer.
 * Action/Route bắt các lỗi này để trả mã HTTP / thông báo phù hợp.
 */

/** Vi phạm ràng buộc duy nhất (vd SKU/email/code trùng) — map từ Prisma P2002. */
export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

/** Không tìm thấy bản ghi. */
export class NotFoundError extends Error {
  constructor(entity: string, id: string) {
    super(`${entity} không tồn tại: ${id}`);
    this.name = "NotFoundError";
  }
}

/** Dữ liệu không hợp lệ ở tầng service (ngoài zod, vd bất biến nghiệp vụ). */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

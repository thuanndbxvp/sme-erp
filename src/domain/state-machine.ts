/**
 * State machine util generic (Mục C4).
 *
 * Định nghĩa map `từ trạng thái → [các trạng thái đến hợp lệ]` và enforce ở service.
 * Mọi entity có vòng đời (SalesOrder, PurchaseOrder, Invoice, ...) khai báo map riêng
 * rồi gọi assertTransition trước khi đổi trạng thái (trong transaction + FOR UPDATE).
 *
 * Chuyển trạng thái không hợp lệ → THROW, không âm thầm bỏ qua.
 */

export type TransitionMap<S extends string> = Readonly<Record<S, readonly S[]>>;

export class InvalidTransitionError extends Error {
  constructor(
    public readonly from: string,
    public readonly to: string,
    public readonly entity?: string,
  ) {
    const prefix = entity ? `${entity}: ` : "";
    super(`${prefix}Chuyển trạng thái không hợp lệ: ${from} → ${to}`);
    this.name = "InvalidTransitionError";
  }
}

/** Kiểm tra transition có hợp lệ không (không ném). */
export function canTransition<S extends string>(
  map: TransitionMap<S>,
  from: S,
  to: S,
): boolean {
  const allowed = map[from];
  if (!allowed) {
    return false;
  }
  return allowed.includes(to);
}

/**
 * Đảm bảo transition hợp lệ, ném InvalidTransitionError nếu không.
 * `entity` (tùy chọn) để thông điệp lỗi rõ nguồn.
 */
export function assertTransition<S extends string>(
  map: TransitionMap<S>,
  from: S,
  to: S,
  entity?: string,
): void {
  if (!canTransition(map, from, to)) {
    throw new InvalidTransitionError(from, to, entity);
  }
}

// ===== Map trạng thái đơn (Mục C4) =====
// Dùng chuỗi literal để không phụ thuộc import Prisma enum trong domain layer;
// giá trị khớp enum OrderStatus / PurchaseStatus trong schema.prisma.

export const SALES_ORDER_TRANSITIONS: TransitionMap<"PENDING" | "DELIVERED" | "CANCELLED"> = {
  PENDING: ["DELIVERED", "CANCELLED"],
  DELIVERED: ["CANCELLED"],
  CANCELLED: [],
};

export const PURCHASE_ORDER_TRANSITIONS: TransitionMap<"ORDERED" | "RECEIVED" | "CANCELLED"> = {
  ORDERED: ["RECEIVED", "CANCELLED"],
  RECEIVED: ["CANCELLED"],
  CANCELLED: [],
};

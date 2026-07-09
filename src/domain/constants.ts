/**
 * Hằng số domain. Các giá trị chuỗi ở đây phải khớp dữ liệu ghi vào DB
 * (InventoryMovement.type/reason ...). Enum Prisma (OrderStatus...) mirror riêng
 * khi tới phase đơn hàng.
 */

/** Chiều di chuyển kho. */
export const MOVEMENT_TYPE = {
  IN: "IN",
  OUT: "OUT",
} as const;
export type MovementType = (typeof MOVEMENT_TYPE)[keyof typeof MOVEMENT_TYPE];

/** Lý do phát sinh movement — gắn với chứng từ vận hành. */
export const MOVEMENT_REASON = {
  PURCHASE_RECEIPT: "PURCHASE_RECEIPT", // nhập mua
  SALES_SHIPMENT: "SALES_SHIPMENT", // xuất bán
  RETURN_IN: "RETURN_IN", // khách trả về kho
  RETURN_OUT: "RETURN_OUT", // trả nhà cung cấp
  ADJUST_IN: "ADJUST_IN", // điều chỉnh tăng
  ADJUST_OUT: "ADJUST_OUT", // điều chỉnh giảm
  DROPSHIP_OUT: "DROPSHIP_OUT", // xuất ảo dropship
} as const;
export type MovementReason = (typeof MOVEMENT_REASON)[keyof typeof MOVEMENT_REASON];

/** Loại chứng từ tham chiếu của movement. */
export const REFERENCE_TYPE = {
  PURCHASE_ORDER: "PURCHASE_ORDER",
  SALES_ORDER: "SALES_ORDER",
  ADJUSTMENT: "ADJUSTMENT",
} as const;
export type ReferenceType = (typeof REFERENCE_TYPE)[keyof typeof REFERENCE_TYPE];

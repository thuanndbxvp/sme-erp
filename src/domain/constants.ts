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
  SYSTEM_INIT: "SYSTEM_INIT", // Khởi tạo số dư đầu kỳ (Opening Balances)
} as const;
export type ReferenceType = (typeof REFERENCE_TYPE)[keyof typeof REFERENCE_TYPE];

// ===== ENUM ĐƠN HÀNG (mirror prisma/schema.prisma — có test kiểm khớp) =====
export const ORDER_STATUS = {
  PENDING: "PENDING",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED",
} as const;
export type OrderStatusValue = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

export const PURCHASE_STATUS = {
  ORDERED: "ORDERED",
  RECEIVED: "RECEIVED",
  CANCELLED: "CANCELLED",
} as const;
export type PurchaseStatusValue = (typeof PURCHASE_STATUS)[keyof typeof PURCHASE_STATUS];

export const FULFILLMENT_TYPE = {
  WAREHOUSE: "WAREHOUSE",
  DROPSHIP: "DROPSHIP",
} as const;
export type FulfillmentTypeValue = (typeof FULFILLMENT_TYPE)[keyof typeof FULFILLMENT_TYPE];

export const PAYMENT_STATUS = {
  UNPAID: "UNPAID",
  PARTIAL: "PARTIAL",
  PAID: "PAID",
} as const;
export type PaymentStatusValue = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

// ===== TIỀN & CÔNG NỢ =====
export const TRANSACTION_TYPE = {
  INCOME: "INCOME",
  EXPENSE: "EXPENSE",
} as const;
export type TransactionTypeValue = (typeof TRANSACTION_TYPE)[keyof typeof TRANSACTION_TYPE];

export const CASH_FLOW_GROUP = {
  OPERATIONAL: "OPERATIONAL",
  INVESTING: "INVESTING",
  FINANCING: "FINANCING",
} as const;
export type CashFlowGroupValue = (typeof CASH_FLOW_GROUP)[keyof typeof CASH_FLOW_GROUP];

// ===== CÔNG NỢ =====
export const INVOICE_TYPE = {
  AR: "AR",
  AP: "AP",
} as const;
export type InvoiceTypeValue = (typeof INVOICE_TYPE)[keyof typeof INVOICE_TYPE];

export const INVOICE_STATUS = {
  OPEN: "OPEN",
  PARTIAL: "PARTIAL",
  PAID: "PAID",
  CANCELLED: "CANCELLED",
} as const;
export type InvoiceStatusValue = (typeof INVOICE_STATUS)[keyof typeof INVOICE_STATUS];

export const PAYMENT_DIRECTION = {
  IN: "IN", // thu
  OUT: "OUT", // chi
} as const;
export type PaymentDirectionValue = (typeof PAYMENT_DIRECTION)[keyof typeof PAYMENT_DIRECTION];

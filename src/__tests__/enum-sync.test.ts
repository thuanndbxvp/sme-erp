import {
  OrderStatus,
  PurchaseStatus,
  FulfillmentType,
  PaymentStatus,
} from "@prisma/client";
import {
  ORDER_STATUS,
  PURCHASE_STATUS,
  FULFILLMENT_TYPE,
  PAYMENT_STATUS,
} from "@/domain/constants";

/**
 * Kiểm hằng số domain khớp Prisma enum (Mục A): cùng tập giá trị, không lệch.
 * Nếu schema đổi enum mà quên mirror → test này đỏ.
 */
function sameEnum(prismaEnum: Record<string, string>, mirror: Record<string, string>) {
  expect(new Set(Object.values(mirror))).toEqual(new Set(Object.values(prismaEnum)));
  // và tên khóa cũng khớp
  expect(new Set(Object.keys(mirror))).toEqual(new Set(Object.keys(prismaEnum)));
}

describe("enum domain <-> Prisma (P2-1a)", () => {
  it("OrderStatus khớp", () => {
    sameEnum(OrderStatus, ORDER_STATUS);
  });
  it("PurchaseStatus khớp", () => {
    sameEnum(PurchaseStatus, PURCHASE_STATUS);
  });
  it("FulfillmentType khớp", () => {
    sameEnum(FulfillmentType, FULFILLMENT_TYPE);
  });
  it("PaymentStatus khớp", () => {
    sameEnum(PaymentStatus, PAYMENT_STATUS);
  });
});

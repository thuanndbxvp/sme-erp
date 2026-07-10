import { Money } from "@/domain/money";
import { PAYMENT_STATUS } from "@/domain/constants";
import type { PaymentStatusValue } from "@/domain/constants";

/**
 * TÍNH LẠI paymentStatus từ số tiền THỰC trên server (bài học V2 #3).
 * KHÔNG tin dữ liệu client. Invoice là nguồn sự thật — paymentStatus
 * của Order DERIVE từ Invoice, không lưu song song 2 nguồn (luật #4).
 *
 * Logic:
 * - paidAmount <= 0                            → UNPAID
 * - paidAmount >= totalAmount                  → PAID
 * - 0 < paidAmount < totalAmount               → PARTIAL
 */
export function computePaymentStatus(
  paidAmount: string | number,
  totalAmount: string | number,
): PaymentStatusValue {
  const paid = Money.of(paidAmount);
  const total = Money.of(totalAmount);

  if (total.isZero()) {
    return PAYMENT_STATUS.UNPAID;
  }
  if (paid.gte(total)) {
    return PAYMENT_STATUS.PAID;
  }
  if (paid.isPositive()) {
    return PAYMENT_STATUS.PARTIAL;
  }
  return PAYMENT_STATUS.UNPAID;
}

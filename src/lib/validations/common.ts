import { z } from "zod";
import { Money } from "@/domain/money";

/**
 * Schema zod dùng chung. Input mọi action/route PHẢI qua zod (Mục A).
 */

/**
 * Tiền: nhận string hoặc number, validate hữu hạn + không âm, chuẩn hóa qua Money
 * (decimal, CẤM float). Trả về chuỗi Decimal đã làm tròn 2 chữ số để ghi DB.
 * Không tin định dạng client — Money.of ném nếu rác.
 */
export const moneySchema = z
  .union([z.string(), z.number()])
  .transform((val, ctx) => {
    let money: Money;
    try {
      money = Money.of(val);
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Số tiền không hợp lệ" });
      return z.NEVER;
    }
    if (money.isNegative()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Số tiền không được âm" });
      return z.NEVER;
    }
    return money.toDecimalString();
  });

/** Chuỗi bắt buộc, trim, không rỗng. */
export const nonEmptyString = z.string().trim().min(1, "Không được để trống");

/** Điện thoại VN đơn giản (tùy chọn): 9–11 chữ số, cho phép rỗng → undefined. */
export const optionalPhone = z
  .string()
  .trim()
  .regex(/^[0-9]{9,11}$/, "Số điện thoại không hợp lệ")
  .optional()
  .or(z.literal("").transform(() => undefined));

/** Email tùy chọn. */
export const optionalEmail = z
  .string()
  .trim()
  .email("Email không hợp lệ")
  .optional()
  .or(z.literal("").transform(() => undefined));

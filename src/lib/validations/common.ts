import { z } from "zod";
import sanitizeHtml from "sanitize-html";
import { Money } from "@/domain/money";

/**
 * Schema zod dùng chung. Input mọi action/route PHẢI qua zod (Mục A).
 */

/**
 * Chuỗi an toàn XSS — strip MỌI thẻ HTML trước khi đưa vào Database.
 * Chống XSS: người dùng nhập <script>...</script> vào note/description sẽ bị
 * làm sạch thành text thuần. Dùng sanitize-html (allowedTags: [] = cấm hết tag).
 *
 * Quan trọng: trim() phải gọi TRƯỚC transform() vì ZodEffects không có .trim().
 */
export const safeString = z
  .string()
  .trim()
  .transform((val) =>
    sanitizeHtml(val, { allowedTags: [], allowedAttributes: {} }),
  );

/** Chuỗi an toàn XSS, bắt buộc, trim, không rỗng. */
export const safeNonEmptyString = z
  .string()
  .trim()
  .transform((val) =>
    sanitizeHtml(val, { allowedTags: [], allowedAttributes: {} }),
  )
  .refine((val) => val.length > 0, "Không được để trống");

/** Chuỗi an toàn XSS, tùy chọn (null/undefined → undefined). */
export const optionalSafeString = z
  .string()
  .trim()
  .transform((val) =>
    sanitizeHtml(val, { allowedTags: [], allowedAttributes: {} }),
  )
  .optional();

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

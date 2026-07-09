import { Decimal } from "decimal.js";

/**
 * Money — value object bất biến cho tiền tệ (VND, DB Decimal(15,2)).
 *
 * Nguyên tắc (Mục A):
 * - CẤM dùng `number` cho tiền ở business logic. Mọi phép tính đi qua Money.
 * - Nội bộ dùng decimal.js → không sai số nhị phân (0.1 + 0.2 === 0.3).
 * - Làm tròn HALF_UP về đúng SCALE chữ số thập phân khi xuất ra (toDecimalString/toNumber).
 * - Bất biến: mọi phép toán trả về Money mới, không sửa tại chỗ.
 */

// Số chữ số thập phân khớp DB Decimal(15,2).
const SCALE = 2;

// Cấu hình decimal.js cục bộ (clone để không ảnh hưởng global Decimal).
const D = Decimal.clone({ rounding: Decimal.ROUND_HALF_UP });

export type MoneyInput = Money | Decimal | string | number;

export class Money {
  private readonly value: Decimal;

  private constructor(value: Decimal) {
    this.value = value;
  }

  /**
   * Tạo Money từ input. Ném lỗi nếu không hữu hạn (NaN/Infinity) — chặn dữ liệu bẩn.
   * number chỉ nên dùng cho hằng số/literal an toàn; giá trị từ client phải qua string.
   */
  static of(input: MoneyInput): Money {
    if (input instanceof Money) {
      return input;
    }
    let d: Decimal;
    try {
      d = new D(input as Decimal.Value);
    } catch {
      throw new Error(`Money: giá trị không hợp lệ: ${String(input)}`);
    }
    if (!d.isFinite()) {
      throw new Error(`Money: giá trị phải hữu hạn, nhận: ${String(input)}`);
    }
    return new Money(d);
  }

  static zero(): Money {
    return new Money(new D(0));
  }

  add(other: MoneyInput): Money {
    return new Money(this.value.plus(Money.of(other).value));
  }

  sub(other: MoneyInput): Money {
    return new Money(this.value.minus(Money.of(other).value));
  }

  /** Nhân với hệ số (vd số lượng). Hệ số là số thuần, không phải tiền. */
  mul(factor: Decimal.Value): Money {
    return new Money(this.value.times(factor));
  }

  /** So sánh: trả -1 nếu this < other, 0 nếu bằng, 1 nếu lớn hơn. */
  compare(other: MoneyInput): -1 | 0 | 1 {
    return this.value.comparedTo(Money.of(other).value) as -1 | 0 | 1;
  }

  eq(other: MoneyInput): boolean {
    return this.compare(other) === 0;
  }

  gt(other: MoneyInput): boolean {
    return this.compare(other) === 1;
  }

  gte(other: MoneyInput): boolean {
    return this.compare(other) >= 0;
  }

  lt(other: MoneyInput): boolean {
    return this.compare(other) === -1;
  }

  lte(other: MoneyInput): boolean {
    return this.compare(other) <= 0;
  }

  isZero(): boolean {
    return this.value.isZero();
  }

  isNegative(): boolean {
    return this.value.isNegative() && !this.value.isZero();
  }

  isPositive(): boolean {
    return this.value.greaterThan(0);
  }

  negate(): Money {
    return new Money(this.value.negated());
  }

  abs(): Money {
    return new Money(this.value.abs());
  }

  /**
   * Chuỗi đã làm tròn về SCALE — dùng để ghi vào DB Decimal(15,2).
   * decimal.js ROUND_HALF_UP đã cấu hình ở clone D.
   */
  toDecimalString(): string {
    return this.value.toFixed(SCALE);
  }

  /** Decimal đã làm tròn SCALE (để truyền cho Prisma). */
  toDecimal(): Decimal {
    return new D(this.toDecimalString());
  }

  /**
   * number — CHỈ dùng cho hiển thị/serialize JSON, KHÔNG dùng lại vào phép tính tiền.
   */
  toNumber(): number {
    return Number(this.toDecimalString());
  }

  toString(): string {
    return this.toDecimalString();
  }

  toJSON(): string {
    return this.toDecimalString();
  }
}

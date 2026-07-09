import { Money } from "@/domain/money";

describe("Money util (P0-3)", () => {
  describe("AC: không sai số float", () => {
    it("0.1 + 0.2 = 0.30 (không phải 0.30000000000000004)", () => {
      const result = Money.of("0.1").add("0.2");
      expect(result.toDecimalString()).toBe("0.30");
      expect(result.eq("0.3")).toBe(true);
    });

    it("cộng dồn 0.1 mười lần = 1.00", () => {
      let m = Money.zero();
      for (let i = 0; i < 10; i++) {
        m = m.add("0.1");
      }
      expect(m.toDecimalString()).toBe("1.00");
    });

    it("0.3 - 0.1 = 0.20", () => {
      expect(Money.of("0.3").sub("0.1").toDecimalString()).toBe("0.20");
    });
  });

  describe("phép toán cơ bản", () => {
    it("add/sub/mul số lớn kiểu VND", () => {
      expect(Money.of("1000000").add("500000").toDecimalString()).toBe("1500000.00");
      expect(Money.of("1000000").sub("250000").toDecimalString()).toBe("750000.00");
      expect(Money.of("15000").mul(3).toDecimalString()).toBe("45000.00");
    });

    it("bất biến — phép toán không sửa toán hạng gốc", () => {
      const a = Money.of("100");
      const b = a.add("50");
      expect(a.toDecimalString()).toBe("100.00");
      expect(b.toDecimalString()).toBe("150.00");
    });

    it("negate / abs", () => {
      expect(Money.of("100").negate().toDecimalString()).toBe("-100.00");
      expect(Money.of("-100").abs().toDecimalString()).toBe("100.00");
    });
  });

  describe("làm tròn HALF_UP về 2 chữ số", () => {
    it("0.005 -> 0.01", () => {
      expect(Money.of("0.005").toDecimalString()).toBe("0.01");
    });
    it("0.004 -> 0.00", () => {
      expect(Money.of("0.004").toDecimalString()).toBe("0.00");
    });
    it("2.675 -> 2.68 (chỗ float thường sai thành 2.67)", () => {
      expect(Money.of("2.675").toDecimalString()).toBe("2.68");
    });
  });

  describe("so sánh", () => {
    it("compare trả -1/0/1", () => {
      expect(Money.of("100").compare("200")).toBe(-1);
      expect(Money.of("200").compare("200")).toBe(0);
      expect(Money.of("300").compare("200")).toBe(1);
    });
    it("gt/gte/lt/lte/eq", () => {
      const m = Money.of("100");
      expect(m.gt("99")).toBe(true);
      expect(m.gte("100")).toBe(true);
      expect(m.lt("101")).toBe(true);
      expect(m.lte("100")).toBe(true);
      expect(m.eq("100")).toBe(true);
    });
  });

  describe("dấu / zero", () => {
    it("isZero / isPositive / isNegative", () => {
      expect(Money.zero().isZero()).toBe(true);
      expect(Money.of("1").isPositive()).toBe(true);
      expect(Money.of("-1").isNegative()).toBe(true);
      expect(Money.zero().isNegative()).toBe(false);
      expect(Money.zero().isPositive()).toBe(false);
    });
  });

  describe("khởi tạo & chặn dữ liệu bẩn", () => {
    it("of(Money) trả về chính nó (idempotent)", () => {
      const a = Money.of("100");
      expect(Money.of(a).toDecimalString()).toBe("100.00");
    });
    it("chấp nhận number literal an toàn", () => {
      expect(Money.of(15000).toDecimalString()).toBe("15000.00");
    });
    it("ném lỗi với NaN", () => {
      expect(() => Money.of(NaN)).toThrow(/hữu hạn|hợp lệ/);
    });
    it("ném lỗi với Infinity", () => {
      expect(() => Money.of(Infinity)).toThrow(/hữu hạn/);
    });
    it("ném lỗi với chuỗi rác", () => {
      expect(() => Money.of("abc")).toThrow(/hợp lệ/);
    });
  });

  describe("serialize", () => {
    it("toNumber / toJSON / toString", () => {
      const m = Money.of("1234.5");
      expect(m.toNumber()).toBe(1234.5);
      expect(m.toJSON()).toBe("1234.50");
      expect(`${m}`).toBe("1234.50");
    });
  });
});

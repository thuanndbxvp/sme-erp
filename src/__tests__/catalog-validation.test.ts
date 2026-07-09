import { createProductSchema, updateProductSchema } from "@/lib/validations/product";
import { createCustomerSchema } from "@/lib/validations/customer";
import { createAccountSchema } from "@/lib/validations/account";
import { moneySchema } from "@/lib/validations/common";

/**
 * Unit test zod danh mục (P1-1) — chứng minh "validation chặn input xấu" (AC).
 * Không chạm DB.
 */
describe("catalog validation (P1-1)", () => {
  describe("moneySchema (decimal, không float, không âm)", () => {
    it("chuẩn hóa số về chuỗi Decimal 2 chữ số", () => {
      expect(moneySchema.parse("1000")).toBe("1000.00");
      expect(moneySchema.parse(15000)).toBe("15000.00");
    });
    it("chặn số âm", () => {
      expect(moneySchema.safeParse("-1").success).toBe(false);
    });
    it("chặn chuỗi rác", () => {
      expect(moneySchema.safeParse("abc").success).toBe(false);
    });
  });

  describe("createProductSchema", () => {
    it("hợp lệ với đủ field", () => {
      const r = createProductSchema.parse({
        sku: "SP001",
        name: "Sản phẩm",
        unit: "cái",
        buyPrice: "10000",
        sellPrice: "15000",
      });
      expect(r.buyPrice).toBe("10000.00");
      expect(r.sellPrice).toBe("15000.00");
    });
    it("mặc định giá = 0 khi thiếu", () => {
      const r = createProductSchema.parse({ sku: "SP", name: "N", unit: "cái" });
      expect(r.buyPrice).toBe("0.00");
      expect(r.sellPrice).toBe("0.00");
    });
    it("chặn sku rỗng", () => {
      expect(
        createProductSchema.safeParse({ sku: "  ", name: "N", unit: "cái" }).success,
      ).toBe(false);
    });
    it("chặn giá âm", () => {
      expect(
        createProductSchema.safeParse({ sku: "S", name: "N", unit: "c", buyPrice: "-5" })
          .success,
      ).toBe(false);
    });
  });

  describe("updateProductSchema KHÔNG cho đổi sku", () => {
    it("bỏ qua field sku nếu gửi lên", () => {
      const r = updateProductSchema.parse({ name: "Tên mới", sku: "HACK" } as unknown);
      expect("sku" in r).toBe(false);
    });
  });

  describe("createCustomerSchema", () => {
    it("phone rỗng → undefined (không lỗi)", () => {
      const r = createCustomerSchema.parse({ name: "KH", phone: "", email: "" });
      expect(r.phone).toBeUndefined();
      expect(r.email).toBeUndefined();
    });
    it("chặn phone sai định dạng", () => {
      expect(createCustomerSchema.safeParse({ name: "KH", phone: "abc" }).success).toBe(
        false,
      );
    });
    it("chặn email sai", () => {
      expect(
        createCustomerSchema.safeParse({ name: "KH", email: "not-an-email" }).success,
      ).toBe(false);
    });
  });

  describe("createAccountSchema KHÔNG có field balance", () => {
    it("bỏ qua balance nếu client gửi (không set số dư qua danh mục)", () => {
      const r = createAccountSchema.parse({
        code: "CASH2",
        name: "Quỹ",
        balance: "999999",
      } as unknown);
      expect("balance" in r).toBe(false);
    });
  });
});

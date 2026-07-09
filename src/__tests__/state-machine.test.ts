import {
  assertTransition,
  canTransition,
  InvalidTransitionError,
  SALES_ORDER_TRANSITIONS,
  PURCHASE_ORDER_TRANSITIONS,
} from "@/domain/state-machine";

describe("state-machine util (P0-5)", () => {
  describe("SalesOrder transitions (C4)", () => {
    it("PENDING → DELIVERED hợp lệ", () => {
      expect(canTransition(SALES_ORDER_TRANSITIONS, "PENDING", "DELIVERED")).toBe(true);
    });
    it("PENDING → CANCELLED hợp lệ", () => {
      expect(canTransition(SALES_ORDER_TRANSITIONS, "PENDING", "CANCELLED")).toBe(true);
    });
    it("DELIVERED → CANCELLED hợp lệ", () => {
      expect(canTransition(SALES_ORDER_TRANSITIONS, "DELIVERED", "CANCELLED")).toBe(true);
    });
    it("DELIVERED → PENDING KHÔNG hợp lệ", () => {
      expect(canTransition(SALES_ORDER_TRANSITIONS, "DELIVERED", "PENDING")).toBe(false);
    });
    it("CANCELLED là trạng thái cuối, không đi đâu được", () => {
      expect(canTransition(SALES_ORDER_TRANSITIONS, "CANCELLED", "DELIVERED")).toBe(false);
      expect(canTransition(SALES_ORDER_TRANSITIONS, "CANCELLED", "PENDING")).toBe(false);
    });
    it("không tự chuyển sang chính mình", () => {
      expect(canTransition(SALES_ORDER_TRANSITIONS, "PENDING", "PENDING")).toBe(false);
    });
  });

  describe("PurchaseOrder transitions (C4)", () => {
    it("ORDERED → RECEIVED hợp lệ", () => {
      expect(canTransition(PURCHASE_ORDER_TRANSITIONS, "ORDERED", "RECEIVED")).toBe(true);
    });
    it("ORDERED → CANCELLED hợp lệ", () => {
      expect(canTransition(PURCHASE_ORDER_TRANSITIONS, "ORDERED", "CANCELLED")).toBe(true);
    });
    it("RECEIVED → ORDERED KHÔNG hợp lệ", () => {
      expect(canTransition(PURCHASE_ORDER_TRANSITIONS, "RECEIVED", "ORDERED")).toBe(false);
    });
  });

  describe("assertTransition ném lỗi đúng", () => {
    it("transition hợp lệ không ném", () => {
      expect(() =>
        assertTransition(SALES_ORDER_TRANSITIONS, "PENDING", "DELIVERED"),
      ).not.toThrow();
    });
    it("transition sai ném InvalidTransitionError", () => {
      expect(() => assertTransition(SALES_ORDER_TRANSITIONS, "DELIVERED", "PENDING")).toThrow(
        InvalidTransitionError,
      );
    });
    it("lỗi chứa from/to và tên entity", () => {
      try {
        assertTransition(SALES_ORDER_TRANSITIONS, "CANCELLED", "DELIVERED", "SalesOrder");
        throw new Error("đáng lẽ phải ném");
      } catch (e) {
        expect(e).toBeInstanceOf(InvalidTransitionError);
        const err = e as InvalidTransitionError;
        expect(err.from).toBe("CANCELLED");
        expect(err.to).toBe("DELIVERED");
        expect(err.entity).toBe("SalesOrder");
        expect(err.message).toContain("SalesOrder");
        expect(err.message).toContain("CANCELLED → DELIVERED");
      }
    });
  });
});

import { safeAction } from "@/lib/action-result";
import {
  CATALOG_REGISTRY,
  CATALOG_ENTITIES,
  isCatalogEntity,
} from "@/domain/catalog-registry";
import { serializeRow } from "@/components/catalog/serialize";
import { ConflictError, ValidationError, NotFoundError } from "@/domain/errors";
import { ForbiddenError, UnauthorizedError } from "@/services/rbac.service";
import { ZodError, z } from "zod";

/**
 * Unit test lớp action/registry/serialize (P1-1b) — không chạm next-auth/DB.
 */
describe("safeAction (P1-1b)", () => {
  it("thành công → ok:true + data", async () => {
    const r = await safeAction(async () => ({ id: "x" }));
    expect(r).toEqual({ ok: true, data: { id: "x" } });
  });

  it("ZodError → fieldErrors theo path", async () => {
    const schema = z.object({ sku: z.string().min(1, "bắt buộc") });
    const r = await safeAction(async () => schema.parse({ sku: "" }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.fieldErrors?.sku).toBe("bắt buộc");
    }
  });

  it("ConflictError → message của lỗi", async () => {
    const r = await safeAction(async () => {
      throw new ConflictError("SKU trùng");
    });
    expect(r).toMatchObject({ ok: false, error: "SKU trùng" });
  });

  it("ValidationError / NotFoundError → message", async () => {
    const v = await safeAction(async () => {
      throw new ValidationError("sai");
    });
    expect(v).toMatchObject({ ok: false, error: "sai" });
    const n = await safeAction(async () => {
      throw new NotFoundError("Sản phẩm", "id1");
    });
    expect(n.ok).toBe(false);
  });

  it("Unauthorized/Forbidden → message thân thiện, không lộ chi tiết", async () => {
    const u = await safeAction(async () => {
      throw new UnauthorizedError();
    });
    expect(u).toMatchObject({ ok: false, error: "Bạn cần đăng nhập" });
    const f = await safeAction(async () => {
      throw new ForbiddenError("product.write");
    });
    expect(f).toMatchObject({
      ok: false,
      error: "Bạn không có quyền thực hiện thao tác này",
    });
  });

  it("lỗi lạ → message chung, không ném ra ngoài", async () => {
    const r = await safeAction(async () => {
      throw new Error("chi tiết nội bộ nhạy cảm");
    });
    expect(r).toMatchObject({ ok: false, error: "Có lỗi xảy ra, vui lòng thử lại" });
    if (!r.ok) {
      expect(r.error).not.toContain("nhạy cảm");
    }
  });

  it("là ZodError thật (sanity)", () => {
    const schema = z.object({ a: z.string() });
    const res = schema.safeParse({ a: 1 });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toBeInstanceOf(ZodError);
    }
  });
});

describe("catalog registry (P1-1b)", () => {
  it("có đủ 5 entity", () => {
    expect(CATALOG_ENTITIES).toHaveLength(4);
  });

  it("isCatalogEntity phân biệt hợp lệ / rác", () => {
    expect(isCatalogEntity("product")).toBe(true);
    expect(isCatalogEntity("hacker")).toBe(false);
  });

  it("mỗi entity có permission write + schema + service + fields", () => {
    for (const e of CATALOG_ENTITIES) {
      const cfg = CATALOG_REGISTRY[e];
      expect(cfg.permissionWrite).toMatch(/\.(write)$/);
      expect(cfg.permissionRead).toMatch(/\.(read)$/);
      expect(cfg.createSchema).toBeDefined();
      expect(typeof cfg.service.create).toBe("function");
      expect(cfg.fields.length).toBeGreaterThan(0);
    }
  });

  it("product/warehouse có field createOnly (sku/code không đổi)", () => {
    expect(CATALOG_REGISTRY.product.fields.find((f: { name: string }) => f.name === "sku")?.createOnly).toBe(
      true,
    );
    expect(CATALOG_REGISTRY.warehouse.fields.find((f: { name: string }) => f.name === "code")?.createOnly).toBe(
      true,
    );
  });
});

describe("serializeRow (P1-1b)", () => {
  it("chuyển Decimal/Date/null → chuỗi, luôn có id", () => {
    const fields = CATALOG_REGISTRY.product.fields;
    const out = serializeRow(
      { id: "p1", sku: "SP1", name: "Tên", unit: "cái", buyPrice: "10000.00", sellPrice: null },
      fields,
    );
    expect(out.id).toBe("p1");
    expect(out.sku).toBe("SP1");
    expect(out.buyPrice).toBe("10000.00");
    expect(out.sellPrice).toBe(""); // null → chuỗi rỗng
  });
});

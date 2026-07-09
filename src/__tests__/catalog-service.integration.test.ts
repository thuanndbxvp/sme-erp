/**
 * Integration test service danh mục (P1-1) — CHẠY TRÊN DB THẬT (Neon).
 * Chứng minh AC: tạo/sửa/xóa mềm hoạt động; SKU/code trùng bị chặn;
 * invariant: Account.balance KHÔNG đổi qua CRUD danh mục.
 * Tự skip nếu không có DATABASE_URL.
 */
import { config } from "dotenv";
config();

import { PrismaClient } from "@prisma/client";
import { ProductService } from "@/services/product.service";
import { AccountService } from "@/services/account.service";
import { WarehouseService } from "@/services/warehouse.service";
import { CustomerService } from "@/services/customer.service";
import { ConflictError, NotFoundError } from "@/domain/errors";

const hasDb = !!process.env.DATABASE_URL;
const describeIf = hasDb ? describe : describe.skip;
jest.setTimeout(60_000);

const prisma = new PrismaClient();
const TAG = "__cat_it__";

async function cleanup() {
  await prisma.product.deleteMany({ where: { sku: { contains: TAG } } });
  await prisma.account.deleteMany({ where: { code: { contains: TAG } } });
  await prisma.warehouse.deleteMany({ where: { code: { contains: TAG } } });
  await prisma.customer.deleteMany({ where: { name: { contains: TAG } } });
}

describeIf("Catalog service integration (P1-1)", () => {
  beforeAll(cleanup);
  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("Product: create → update → soft delete hoạt động", async () => {
    const created = await ProductService.create(
      { sku: `${TAG}-P1`, name: "SP A", unit: "cái", buyPrice: "10000.00", sellPrice: "15000.00" },
      prisma,
    );
    expect(created.isActive).toBe(true);
    expect(created.sellPrice.toString()).toBe("15000");

    const updated = await ProductService.update(created.id, { name: "SP A sửa" }, prisma);
    expect(updated.name).toBe("SP A sửa");

    const deactivated = await ProductService.deactivate(created.id, prisma);
    expect(deactivated.isActive).toBe(false);

    // list mặc định không trả bản ghi inactive
    const active = await ProductService.list({}, prisma);
    expect(active.find((p) => p.id === created.id)).toBeUndefined();
    const all = await ProductService.list({ includeInactive: true }, prisma);
    expect(all.find((p) => p.id === created.id)).toBeDefined();
  });

  it("Product: SKU trùng → ConflictError", async () => {
    const sku = `${TAG}-DUP`;
    await ProductService.create({ sku, name: "A", unit: "cái", buyPrice: "0.00", sellPrice: "0.00" }, prisma);
    await expect(
      ProductService.create(
        { sku, name: "B", unit: "cái", buyPrice: "0.00", sellPrice: "0.00" },
        prisma,
      ),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("Product: update id không tồn tại → NotFoundError", async () => {
    await expect(
      ProductService.update("khong-ton-tai", { name: "x" }, prisma),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("Warehouse: code trùng → ConflictError", async () => {
    const code = `${TAG}-WH`;
    await WarehouseService.create({ code, name: "Kho 1" }, prisma);
    await expect(
      WarehouseService.create({ code, name: "Kho 2" }, prisma),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("Customer: create với phone/email undefined ok", async () => {
    const c = await CustomerService.create(
      { name: `${TAG}-KH`, creditLimit: "0.00" },
      prisma,
    );
    expect(c.phone).toBeNull();
    expect(c.email).toBeNull();
  });

  it("INVARIANT: Account.balance KHÔNG đổi qua create/update danh mục", async () => {
    const acc = await AccountService.create({ code: `${TAG}-ACC`, name: "Quỹ test" }, prisma);
    // create luôn balance = 0
    expect(acc.balance.toString()).toBe("0");

    // update chỉ đổi name; balance giữ nguyên 0
    const updated = await AccountService.update(acc.id, { name: "Quỹ đổi tên" }, prisma);
    expect(updated.name).toBe("Quỹ đổi tên");
    expect(updated.balance.toString()).toBe("0");

    // Kể cả nếu DB có sẵn số dư (mô phỏng sau giao dịch), update danh mục không được đụng
    await prisma.account.update({ where: { id: acc.id }, data: { balance: "500000" } });
    const afterUpdate = await AccountService.update(acc.id, { name: "Đổi lần 2" }, prisma);
    expect(afterUpdate.balance.toString()).toBe("500000"); // vẫn nguyên, service không ghi đè
  });
});

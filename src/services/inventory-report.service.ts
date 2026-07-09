import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { Money } from "@/domain/money";

/**
 * InventoryReportService — báo cáo tồn kho (P1-4). CHỈ ĐỌC, không đổi state.
 *
 * Nguồn sự thật: WarehouseInventory (quantity, avgCost). Giá trị tồn per lô =
 * avgCost * quantity, cộng dồn bằng Money (decimal, không float).
 */

export interface StockLine {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  /** Tổng giá trị tồn = Σ(avgCost*qty) các lô, chuỗi Decimal 2 chữ số. */
  stockValue: string;
}

export interface WarehouseStockLine {
  warehouseId: string;
  code: string;
  name: string;
  quantity: number;
  stockValue: string;
}

export class InventoryReportService {
  /**
   * Tồn theo sản phẩm (gộp mọi lô, tùy chọn lọc theo kho).
   * Mặc định bỏ dòng quantity=0.
   */
  static async stockByProduct(
    opts: { warehouseId?: string; includeZero?: boolean } = {},
    prisma: PrismaClient = defaultPrisma,
  ): Promise<StockLine[]> {
    const rows = await prisma.warehouseInventory.findMany({
      where: opts.warehouseId ? { warehouseId: opts.warehouseId } : undefined,
      include: { product: { select: { sku: true, name: true } } },
    });

    const byProduct = new Map<string, StockLine & { valueMoney: Money }>();
    for (const row of rows) {
      const lineValue = Money.of(row.avgCost.toString()).mul(row.quantity);
      const existing = byProduct.get(row.productId);
      if (existing) {
        existing.quantity += row.quantity;
        existing.valueMoney = existing.valueMoney.add(lineValue);
      } else {
        byProduct.set(row.productId, {
          productId: row.productId,
          sku: row.product.sku,
          name: row.product.name,
          quantity: row.quantity,
          stockValue: "0",
          valueMoney: lineValue,
        });
      }
    }

    const result: StockLine[] = [];
    for (const line of byProduct.values()) {
      if (!opts.includeZero && line.quantity === 0) {
        continue;
      }
      result.push({
        productId: line.productId,
        sku: line.sku,
        name: line.name,
        quantity: line.quantity,
        stockValue: line.valueMoney.toDecimalString(),
      });
    }
    result.sort((a, b) => a.sku.localeCompare(b.sku));
    return result;
  }

  /** Tồn + giá trị theo từng kho. */
  static async stockByWarehouse(
    opts: { includeZero?: boolean } = {},
    prisma: PrismaClient = defaultPrisma,
  ): Promise<WarehouseStockLine[]> {
    const rows = await prisma.warehouseInventory.findMany({
      include: { warehouse: { select: { code: true, name: true } } },
    });

    const byWarehouse = new Map<string, WarehouseStockLine & { valueMoney: Money }>();
    for (const row of rows) {
      const lineValue = Money.of(row.avgCost.toString()).mul(row.quantity);
      const existing = byWarehouse.get(row.warehouseId);
      if (existing) {
        existing.quantity += row.quantity;
        existing.valueMoney = existing.valueMoney.add(lineValue);
      } else {
        byWarehouse.set(row.warehouseId, {
          warehouseId: row.warehouseId,
          code: row.warehouse.code,
          name: row.warehouse.name,
          quantity: row.quantity,
          stockValue: "0",
          valueMoney: lineValue,
        });
      }
    }

    const result: WarehouseStockLine[] = [];
    for (const line of byWarehouse.values()) {
      if (!opts.includeZero && line.quantity === 0) {
        continue;
      }
      result.push({
        warehouseId: line.warehouseId,
        code: line.code,
        name: line.name,
        quantity: line.quantity,
        stockValue: line.valueMoney.toDecimalString(),
      });
    }
    result.sort((a, b) => a.code.localeCompare(b.code));
    return result;
  }

  /** Tổng giá trị tồn toàn hệ (tùy chọn theo kho). */
  static async totalStockValue(
    opts: { warehouseId?: string } = {},
    prisma: PrismaClient = defaultPrisma,
  ): Promise<string> {
    const rows = await prisma.warehouseInventory.findMany({
      where: opts.warehouseId ? { warehouseId: opts.warehouseId } : undefined,
      select: { quantity: true, avgCost: true },
    });
    let total = Money.zero();
    for (const row of rows) {
      total = total.add(Money.of(row.avgCost.toString()).mul(row.quantity));
    }
    return total.toDecimalString();
  }
}

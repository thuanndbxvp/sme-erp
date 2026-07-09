import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { Money } from "@/domain/money";
import { ValidationError } from "@/domain/errors";
import { MOVEMENT_TYPE, type MovementReason, type ReferenceType } from "@/domain/constants";

/**
 * InventoryService.recordMovement (invariant C1).
 *
 * - PHẢI chạy trong transaction; SELECT ... FOR UPDATE row WarehouseInventory
 *   trước khi đọc/ghi (chống race → oversell / WAC sai).
 * - OUT làm quantity âm → throw "Kho không đủ hàng".
 * - IN có unitCost → avgCost = (oldQty*oldCost + inQty*unitCost) / newQty (WAC).
 * - Ghi đúng 1 InventoryMovement. Idempotent theo (referenceType, referenceId, reason):
 *   gọi lại cùng khóa → trả movement cũ, KHÔNG cộng/trừ tồn lần nữa.
 */

// Prisma transaction client (không có $transaction/$connect...).
type TxClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export interface RecordMovementInput {
  type: (typeof MOVEMENT_TYPE)[keyof typeof MOVEMENT_TYPE];
  reason: MovementReason;
  productId: string;
  warehouseId: string;
  quantity: number; // luôn > 0; chiều do `type` quyết định
  unitCost: string | number; // đơn giá vốn/unit (chỉ dùng khi IN cho WAC)
  referenceType: ReferenceType;
  referenceId: string;
  batchNumber?: string;
  expiryDate?: Date | null;
}

export class InventoryService {
  static async recordMovement(tx: TxClient, input: RecordMovementInput) {
    if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
      throw new ValidationError("Số lượng phải là số nguyên dương");
    }
    const batchNumber = input.batchNumber ?? "";

    // Idempotent: đã có movement cùng (reference, reason) → trả về, không side-effect lại.
    const existing = await tx.inventoryMovement.findUnique({
      where: {
        referenceType_referenceId_reason: {
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          reason: input.reason,
        },
      },
    });
    if (existing) {
      return existing;
    }

    // Đảm bảo row tồn tồn tại rồi KHÓA nó (FOR UPDATE). Tạo trước nếu chưa có để
    // có row mà khóa; createMany skipDuplicates tránh đua tạo trùng.
    await tx.warehouseInventory.createMany({
      data: [
        {
          warehouseId: input.warehouseId,
          productId: input.productId,
          batchNumber,
          quantity: 0,
          avgCost: "0",
        },
      ],
      skipDuplicates: true,
    });

    // SELECT ... FOR UPDATE — khóa row tồn theo (kho, sp, lô).
    const locked = await tx.$queryRaw<
      Array<{ id: string; quantity: number; avgCost: Prisma.Decimal }>
    >`
      SELECT "id", "quantity", "avgCost"
      FROM "WarehouseInventory"
      WHERE "warehouseId" = ${input.warehouseId}
        AND "productId" = ${input.productId}
        AND "batchNumber" = ${batchNumber}
      FOR UPDATE
    `;
    const row = locked[0];
    if (!row) {
      // Không thể xảy ra sau createMany, nhưng phòng thủ.
      throw new ValidationError("Không khóa được row tồn kho");
    }

    const oldQty = row.quantity;
    const oldCost = Money.of(row.avgCost.toString());
    const unitCost = Money.of(input.unitCost);

    let newQty: number;
    let newAvgCost: Money;

    if (input.type === MOVEMENT_TYPE.IN) {
      newQty = oldQty + input.quantity;
      // WAC = (oldQty*oldCost + inQty*unitCost) / newQty
      const oldValue = oldCost.mul(oldQty);
      const inValue = unitCost.mul(input.quantity);
      newAvgCost = newQty > 0 ? oldValue.add(inValue).divBy(newQty) : Money.zero();
    } else {
      // OUT
      newQty = oldQty - input.quantity;
      if (newQty < 0) {
        throw new ValidationError("Kho không đủ hàng");
      }
      // Xuất kho theo giá vốn hiện hành, avgCost giữ nguyên.
      newAvgCost = oldCost;
    }

    await tx.warehouseInventory.update({
      where: { id: row.id },
      data: { quantity: newQty, avgCost: newAvgCost.toDecimalString() },
    });

    // Giá vốn của chính movement: IN dùng unitCost nhập; OUT dùng avgCost hiện hành.
    const movementUnitCost = input.type === MOVEMENT_TYPE.IN ? unitCost : oldCost;
    const totalCost = movementUnitCost.mul(input.quantity);

    return tx.inventoryMovement.create({
      data: {
        type: input.type,
        reason: input.reason,
        productId: input.productId,
        warehouseId: input.warehouseId,
        quantity: input.quantity,
        unitCost: movementUnitCost.toDecimalString(),
        totalCost: totalCost.toDecimalString(),
        referenceType: input.referenceType,
        referenceId: input.referenceId,
      },
    });
  }

  /** Helper: mở transaction rồi gọi recordMovement (cho caller không tự quản tx). */
  static async recordMovementInTransaction(
    input: RecordMovementInput,
    prisma: PrismaClient = defaultPrisma,
  ) {
    return prisma.$transaction((tx) => InventoryService.recordMovement(tx, input));
  }
}

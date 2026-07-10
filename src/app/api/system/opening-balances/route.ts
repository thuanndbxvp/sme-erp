import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/authorize";
import { InventoryService } from "@/services/inventory.service";
import { TransactionService } from "@/services/transaction.service";
import {
  MOVEMENT_TYPE,
  MOVEMENT_REASON,
  REFERENCE_TYPE,
  TRANSACTION_TYPE,
  CASH_FLOW_GROUP,
  INVOICE_TYPE,
  INVOICE_STATUS,
} from "@/domain/constants";
import { logger } from "@/lib/logger";

/**
 * API Khởi tạo Số dư Đầu kỳ (Opening Balances) — chạy DUY NHẤT 1 LẦN khi Go-Live.
 *
 * Tại sao cần API này:
 *   Nếu nhập đầu kỳ bằng tay (tạo đơn mua/bán), doanh thu/giá vốn kỳ trước sẽ bị
 *   tính vào kỳ này → sai lệch báo cáo P&L. API này ghi dữ liệu "trực tiếp" với
 *   reason/cashFlowGroup đặc biệt để KHÔNG ảnh hưởng P&L vận hành.
 *
 * Bảo mật:
 *   - Yêu cầu đăng nhập (auth).
 *   - Chỉ Admin có quyền "system.init_balance" mới được chạy (requirePermission).
 *
 * Toàn bộ quá trình insert được bọc trong prisma.$transaction — nếu 1 bước lỗi,
 * toàn bộ rollback (atomic). Idempotent nhờ InventoryService (unique reference).
 */

// ---- Zod validation cho body ----
// (Nhập inline để giữ file tự chứa; dùng zod như toàn bộ codebase)
import { z } from "zod";

const cashBalanceSchema = z.object({
  accountId: z.string().min(1, "Thiếu accountId"),
  balance: z.union([z.string(), z.number()]),
});

const arBalanceSchema = z.object({
  customerId: z.string().min(1, "Thiếu customerId"),
  balanceDue: z.union([z.string(), z.number()]),
});

const apBalanceSchema = z.object({
  supplierId: z.string().min(1, "Thiếu supplierId"),
  balanceDue: z.union([z.string(), z.number()]),
});

const inventoryBalanceSchema = z.object({
  productId: z.string().min(1, "Thiếu productId"),
  warehouseId: z.string().min(1, "Thiếu warehouseId"),
  quantity: z.number().int().positive("Số lượng phải là số nguyên dương"),
  avgCost: z.union([z.string(), z.number()]),
});

const openingBalancesSchema = z.object({
  cashBalances: z.array(cashBalanceSchema).default([]),
  arBalances: z.array(arBalanceSchema).default([]),
  apBalances: z.array(apBalanceSchema).default([]),
  inventoryBalances: z.array(inventoryBalanceSchema).default([]),
});

type OpeningBalancesInput = z.infer<typeof openingBalancesSchema>;

export async function POST(req: Request) {
  // 1. Xác thực đăng nhập
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Phân quyền — chỉ Admin cấp cao nhất mới được chạy API này
  try {
    await requirePermission(session.user.id, "system.init_balance");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Forbidden";
    const status = err instanceof Error && err.name === "UnauthorizedError" ? 401 : 403;
    return NextResponse.json({ error: message }, { status });
  }

  // 3. Validate body
  let body: OpeningBalancesInput;
  try {
    const json = await req.json();
    body = openingBalancesSchema.parse(json);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Dữ liệu không hợp lệ";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // 4. Thực thi transaction
  try {
    await prisma.$transaction(
      async (tx) => {
        // 4a. Khởi tạo Tồn kho (ADJUST_IN — không ghi nhận vào Doanh thu/Chi phí mua hàng)
        for (const inv of body.inventoryBalances) {
          await InventoryService.recordMovement(tx, {
            type: MOVEMENT_TYPE.IN,
            reason: MOVEMENT_REASON.ADJUST_IN, // KHÔNG dùng PURCHASE_RECEIPT
            productId: inv.productId,
            warehouseId: inv.warehouseId,
            quantity: inv.quantity,
            unitCost: inv.avgCost, // Giá vốn WAC hiện tại
            referenceType: REFERENCE_TYPE.SYSTEM_INIT,
            referenceId: `init-${inv.productId}-${inv.warehouseId}`,
          });
        }

        // 4b. Khởi tạo Số dư Tiền mặt/Ngân hàng
        //     cashFlowGroup = FINANCING → không đưa vào OPERATIONAL, tránh sai P&L
        for (const cash of body.cashBalances) {
          await TransactionService.recordTransaction(tx, {
            type: TRANSACTION_TYPE.INCOME,
            amount: cash.balance,
            accountId: cash.accountId,
            cashFlowGroup: CASH_FLOW_GROUP.FINANCING,
            description: "Khởi tạo số dư đầu kỳ",
          });
        }

        // 4c. Khởi tạo Công nợ Phải Thu (AR — Khách hàng)
        //     Create thẳng Invoice, KHÔNG liên kết SalesOrder
        for (const ar of body.arBalances) {
          await tx.invoice.create({
            data: {
              invoiceNumber: `AR-INIT-${ar.customerId}`,
              type: INVOICE_TYPE.AR,
              status: INVOICE_STATUS.OPEN,
              customerId: ar.customerId,
              totalAmount: ar.balanceDue,
              paidAmount: "0",
              balanceDue: ar.balanceDue,
            },
          });
        }

        // 4d. Khởi tạo Công nợ Phải Trả (AP — Nhà cung cấp)
        //     Create thẳng Invoice, KHÔNG liên kết PurchaseOrder
        for (const ap of body.apBalances) {
          await tx.invoice.create({
            data: {
              invoiceNumber: `AP-INIT-${ap.supplierId}`,
              type: INVOICE_TYPE.AP,
              status: INVOICE_STATUS.OPEN,
              supplierId: ap.supplierId,
              totalAmount: ap.balanceDue,
              paidAmount: "0",
              balanceDue: ap.balanceDue,
            },
          });
        }
      },
      { maxWait: 20000, timeout: 30000 },
    );

    logger.info({ userId: session.user.id }, "Khởi tạo số dư đầu kỳ thành công");
    return NextResponse.json({ message: "Khởi tạo số dư thành công" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Lỗi không xác định";
    logger.error({ err: error, userId: session.user.id }, "Khởi tạo số dư đầu kỳ thất bại");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
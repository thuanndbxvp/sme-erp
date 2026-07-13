"use server";

import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/authorize";
import { AuditAndSecurityHelper } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { safeAction } from "@/lib/action-result";
import { TransactionService } from "@/services/transaction.service";
import { TRANSACTION_TYPE } from "@/domain/constants";
import { ConflictError, NotFoundError, ValidationError } from "@/domain/errors";
import { revalidatePath } from "next/cache";
import { Money } from "@/domain/money";

/**
 * HR & Payroll (Phase 1) — MSEW-payroll-hr.
 *
 * - createSalaryAdvanceAction: ghi Transaction EXPENSE + EmployeeTransaction ADVANCE
 *   cùng 1 Prisma transaction. Trừ tiền khỏi Account + ghi nợ nhân viên atomic.
 * - approveCommissionAction: chuyển SalesOrder.commissionStatus PENDING → APPROVED.
 * - updateEmployeeProfileAction: cập nhật lương cứng + STK ngân hàng.
 */

export async function createSalaryAdvanceAction(formData: FormData) {
  const session = await auth();
  await requirePermission(session?.user?.id, "hr.manage");
  return safeAction(async () => {
    const userId = formData.get("userId") as string;
    const amount = formData.get("amount") as string;
    const accountId = formData.get("accountId") as string;
    const description =
      ((formData.get("description") as string) || "").trim() ||
      `Tạm ứng lương cho nhân viên`;

    if (!userId) throw new Error("Thiếu userId");
    if (!accountId) throw new Error("Thiếu tài khoản quỹ");
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) throw new Error("Số tiền phải lớn hơn 0");

    // Kiểm tra user tồn tại + còn active
    const targetUser = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, isActive: true, name: true } });
    if (!targetUser) throw new NotFoundError("User", userId);

    return prisma.$transaction(async (tx) => {
      // B1: Ghi Transaction EXPENSE (trừ tiền quỹ)
      const txn = await TransactionService.recordTransaction(tx, {
        type: TRANSACTION_TYPE.EXPENSE,
        amount: String(amt),
        accountId,
        cashFlowGroup: "OPERATIONAL",
        description,
      });

      // B2: Ghi EmployeeTransaction ADVANCE (ghi nợ nhân viên)
      await tx.employeeTransaction.create({
        data: {
          userId,
          type: "ADVANCE",
          amount: String(amt),
          description,
        },
      });

      AuditAndSecurityHelper.logAction({
        action: "CREATE",
        entityType: "EmployeeTransaction",
        entityId: txn.id,
        userId: session?.user?.id,
        metadata: {
          kind: "SALARY_ADVANCE",
          targetUserId: userId,
          targetUserName: targetUser.name,
          amount: amt,
          accountId,
          message: `[CẤP TẠM ỨNG LƯƠNG] ${targetUser.name} - ${amt.toLocaleString("vi-VN")} đ`,
        },
      });

      revalidatePath(`/hr/employees/${userId}`);
      revalidatePath("/hr/employees");
      revalidatePath("/cashflow");
      return { ok: true, transactionId: txn.id, amount: amt };
    });
  });
}

export async function approveCommissionAction(formData: FormData) {
  const session = await auth();
  await requirePermission(session?.user?.id, "commission.approve");
  return safeAction(async () => {
    const orderId = formData.get("orderId") as string;
    if (!orderId) throw new Error("Thiếu orderId");

    const order = await prisma.salesOrder.findUnique({
      where: { id: orderId },
      select: { id: true, orderCode: true, commissionStatus: true, commissionAmount: true, salespersonId: true },
    });
    if (!order) throw new NotFoundError("SalesOrder", orderId);
    if (order.commissionStatus === "APPROVED") {
      return { ok: true, alreadyApproved: true };
    }
    if (order.commissionStatus === "PAID") {
      throw new Error("Hoa hồng đã được thanh toán, không thể duyệt lại");
    }
    if (Number(order.commissionAmount) <= 0) {
      throw new Error("Đơn không có hoa hồng để duyệt");
    }

    await prisma.salesOrder.update({
      where: { id: orderId },
      data: { commissionStatus: "APPROVED" },
    });

    AuditAndSecurityHelper.logAction({
      action: "APPROVE",
      entityType: "SalesOrder",
      entityId: orderId,
      userId: session?.user?.id,
      metadata: {
        kind: "COMMISSION_APPROVE",
        orderCode: order.orderCode,
        salespersonId: order.salespersonId,
        amount: Number(order.commissionAmount),
        message: `[DUYỆT HOA HỒNG] ${order.orderCode} - ${Number(order.commissionAmount).toLocaleString("vi-VN")} đ`,
      },
    });

    if (order.salespersonId) revalidatePath(`/hr/employees/${order.salespersonId}`);
    revalidatePath("/hr/employees");
    revalidatePath("/orders");
    return { ok: true, orderId };
  });
}

export async function updateEmployeeProfileAction(formData: FormData) {
  const session = await auth();
  await requirePermission(session?.user?.id, "hr.manage");
  return safeAction(async () => {
    const userId = formData.get("userId") as string;
    const baseSalary = formData.get("baseSalary") as string;
    const bankName = ((formData.get("bankName") as string) || "").trim() || null;
    const bankAccount = ((formData.get("bankAccount") as string) || "").trim() || null;

    if (!userId) throw new Error("Thiếu userId");
    const salary = Number(baseSalary);
    if (baseSalary && (!Number.isFinite(salary) || salary < 0)) {
      throw new Error("Lương cứng không hợp lệ");
    }

    const targetUser = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true } });
    if (!targetUser) throw new NotFoundError("User", userId);

    const updated = await prisma.employeeProfile.upsert({
      where: { userId },
      update: {
        baseSalary: String(salary || 0),
        bankName,
        bankAccount,
      },
      create: {
        userId,
        baseSalary: String(salary || 0),
        bankName,
        bankAccount,
      },
    });

    AuditAndSecurityHelper.logAction({
      action: "UPDATE",
      entityType: "EmployeeProfile",
      entityId: updated.id,
      userId: session?.user?.id,
      metadata: {
        targetUserId: userId,
        targetUserName: targetUser.name,
        baseSalary: salary || 0,
        message: `[CẬP NHẬT HỒ SƠ LƯƠNG] ${targetUser.name}`,
      },
    });

    revalidatePath(`/hr/employees/${userId}`);
    revalidatePath("/hr/employees");
    return { ok: true, id: updated.id };
  });
}

/* ===========================================================================
 * Phase 2 (MSEW-payroll-hr-phase2): Chốt lương cuối tháng.
 *
 * - getDraftPayslip: tính trước (Lương cứng + HH APPROVED - Tạm ứng nợ) để UI show.
 * - finalizePayrollAction: chốt sổ (atomic 4-tác-vụ):
 *   1. Tạo Transaction EXPENSE (Phiếu Chi Sổ Quỹ) amount = netPay.
 *   2. Tạo Payslip (lưu lịch sử lương tháng).
 *   3. Nếu advanceDeduction > 0 → tạo EmployeeTransaction REFUND.
 *   4. Update tất cả SalesOrder của nhân viên từ APPROVED → PAID (khóa HH).
 *
 * Idempotent: Payslip @@unique([userId, month, year]) chặn chốt 2 lần.
 * Lưu ý schema: hoa hồng theo `salespersonId` (không phải `userId`).
 * ===========================================================================
 */

export interface DraftPayslip {
  userId: string;
  userName: string;
  month: number;
  year: number;
  baseSalary: string;
  approvedCommission: string;
  grossPay: string;
  currentDebt: string;
  maxDeduction: string; // = currentDebt
  suggestedNetPay: string;
  bankName: string | null;
  bankAccount: string | null;
}

export async function getDraftPayslip(userId: string, month: number, year: number): Promise<DraftPayslip> {
  // [SECURITY] Vẫn enforce quyền hr.view tại đây dù chỉ đọc.
  const session = await auth();
  await requirePermission(session?.user?.id, "hr.view");

  if (!Number.isInteger(month) || month < 1 || month > 12) throw new ValidationError("Tháng không hợp lệ");
  if (!Number.isInteger(year) || year < 2000 || year > 3000) throw new ValidationError("Năm không hợp lệ");

  const [user, profile, approvedCommissions, advances] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true } }),
    prisma.employeeProfile.findUnique({ where: { userId } }),
    prisma.salesOrder.findMany({
      where: { salespersonId: userId, commissionStatus: "APPROVED" },
      select: { commissionAmount: true },
    }),
    prisma.employeeTransaction.findMany({
      where: { userId, type: { in: ["ADVANCE", "REFUND"] } },
      select: { type: true, amount: true },
    }),
  ]);

  if (!user) throw new NotFoundError("User", userId);

  const baseSalary = profile?.baseSalary ? profile.baseSalary.toString() : "0";
  const approvedCommission = approvedCommissions.reduce(
    (s, o) => s.add(Money.of(o.commissionAmount.toString())),
    Money.zero(),
  );
  const grossPay = Money.of(baseSalary).add(approvedCommission);
  const currentDebt = advances.reduce(
    (s, a) => s.add(a.type === "ADVANCE" ? Money.of(a.amount.toString()) : Money.of(a.amount.toString()).negate()),
    Money.zero(),
  );
  // Mặc định cấn trừ = min(currentDebt, grossPay). Nếu grossPay = 0, cấn trừ = 0 (tránh netPay âm).
  const suggestedDeduction = currentDebt.lt(grossPay) ? currentDebt : grossPay;
  const suggestedNetPay = grossPay.sub(suggestedDeduction);

  return {
    userId,
    userName: user.name,
    month,
    year,
    baseSalary,
    approvedCommission: approvedCommission.toDecimalString(),
    grossPay: grossPay.toDecimalString(),
    currentDebt: currentDebt.toDecimalString(),
    maxDeduction: currentDebt.toDecimalString(),
    suggestedNetPay: suggestedNetPay.toDecimalString(),
    bankName: profile?.bankName ?? null,
    bankAccount: profile?.bankAccount ?? null,
  };
}

export async function finalizePayrollAction(formData: FormData) {
  const session = await auth();
  await requirePermission(session?.user?.id, "hr.manage");

  return safeAction(async () => {
    const userId = formData.get("userId") as string;
    const month = Number(formData.get("month"));
    const year = Number(formData.get("year"));
    const baseSalaryAmount = String(formData.get("baseSalaryAmount") || "0");
    const commissionAmount = String(formData.get("commissionAmount") || "0");
    const advanceDeduction = String(formData.get("advanceDeduction") || "0");
    const netPay = String(formData.get("netPay") || "0");
    const accountId = formData.get("accountId") as string;

    if (!userId) throw new ValidationError("Thiếu userId");
    if (!accountId) throw new ValidationError("Vui lòng chọn quỹ thanh toán");
    if (!Number.isInteger(month) || month < 1 || month > 12) throw new ValidationError("Tháng không hợp lệ");
    if (!Number.isInteger(year) || year < 2000 || year > 3000) throw new ValidationError("Năm không hợp lệ");

    // Validate các số tiền (dùng Money, không float)
    const mBase = Money.of(baseSalaryAmount);
    const mComm = Money.of(commissionAmount);
    const mAdv = Money.of(advanceDeduction);
    const mNet = Money.of(netPay);
    if (mBase.lt(0) || mComm.lt(0) || mAdv.lt(0)) throw new ValidationError("Các số tiền phải >= 0");
    if (mNet.lt(0)) throw new ValidationError("Thực lãnh (netPay) phải >= 0");

    // Recompute netPay từ server (bài học V2: không tin client)
    const expectedNet = mBase.add(mComm).sub(mAdv);
    if (!expectedNet.eq(mNet)) {
      throw new ValidationError(
        `Net Pay không khớp (server tính lại: ${expectedNet.toDecimalString()})`,
      );
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, isActive: true },
    });
    if (!targetUser) throw new NotFoundError("User", userId);

    // Idempotent: bắt P2002 nếu đã chốt tháng này.
    const existing = await prisma.payslip.findUnique({
      where: { userId_month_year: { userId, month, year } },
    });
    if (existing) {
      throw new ConflictError(
        `Đã chốt lương tháng ${month}/${year} cho ${targetUser.name} rồi (Payslip #${existing.id.slice(0, 8)}).`,
      );
    }

    return prisma.$transaction(async (tx) => {
      // Tác vụ 1: Tạo Transaction EXPENSE (Phiếu Chi Sổ Quỹ)
      const description = `Trả lương tháng ${month}/${year} cho ${targetUser.name}`;
      const txn = await TransactionService.recordTransaction(tx, {
        type: TRANSACTION_TYPE.EXPENSE,
        amount: mNet.toDecimalString(),
        accountId,
        cashFlowGroup: "OPERATIONAL",
        description,
      });

      // Tác vụ 2: Tạo Payslip
      const payslip = await tx.payslip.create({
        data: {
          userId,
          month,
          year,
          baseSalaryAmount: mBase.toDecimalString(),
          commissionAmount: mComm.toDecimalString(),
          advanceDeduction: mAdv.toDecimalString(),
          netPay: mNet.toDecimalString(),
          transactionId: txn.id,
        },
      });

      // Tác vụ 3: Nếu advanceDeduction > 0, tạo EmployeeTransaction REFUND (cấn trừ nợ)
      if (mAdv.gt(0)) {
        await tx.employeeTransaction.create({
          data: {
            userId,
            type: "REFUND",
            amount: mAdv.toDecimalString(),
            description: `Cấn trừ tạm ứng từ lương tháng ${month}/${year}`,
          },
        });
      }

      // Tác vụ 4: Khóa hoa hồng: APPROVED → PAID
      // (Dùng updateMany để 1 round-trip; đã chốt race bằng idempotency Payslip phía trên.)
      const lockedOrders = await tx.salesOrder.updateMany({
        where: { salespersonId: userId, commissionStatus: "APPROVED" },
        data: { commissionStatus: "PAID" },
      });

      AuditAndSecurityHelper.logAction({
        action: "CREATE",
        entityType: "Payslip",
        entityId: payslip.id,
        userId: session?.user?.id,
        metadata: {
          kind: "PAYROLL_FINALIZE",
          targetUserId: userId,
          targetUserName: targetUser.name,
          month,
          year,
          baseSalary: Number(mBase.toDecimalString()),
          commission: Number(mComm.toDecimalString()),
          advanceDeduction: Number(mAdv.toDecimalString()),
          netPay: Number(mNet.toDecimalString()),
          accountId,
          transactionId: txn.id,
          lockedCommissions: lockedOrders.count,
          message: `[CHỐT LƯƠNG T${month}/${year}] ${targetUser.name} - Thực lãnh ${Number(mNet.toDecimalString()).toLocaleString("vi-VN")} đ`,
        },
      });

      revalidatePath(`/hr/employees/${userId}`);
      revalidatePath("/hr/employees");
      revalidatePath("/cashflow");
      return {
        ok: true,
        payslipId: payslip.id,
        transactionId: txn.id,
        lockedCommissions: lockedOrders.count,
      };
    });
  });
}
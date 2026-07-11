import { prisma } from "@/lib/prisma";
import { SystemSettingService } from "@/services/system-setting.service";
import { Prisma } from "@prisma/client";

/**
 * Các hàm hỗ trợ Tầng 1: Core Foundations & Data Integrity
 */
export class AuditAndSecurityHelper {
  /**
   * 1. Ghi nhận Audit Log (Nhật ký thay đổi)
   * Chạy song song không chặn main thread.
   */
  static logAction(params: {
    action: "CREATE" | "UPDATE" | "DELETE" | "APPROVE" | "CANCEL";
    entityType: string; // VD: "INVOICE", "SALES_ORDER"
    entityId: string;
    userId?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;
  }) {
    // Fire and forget, không await để tránh làm chậm response
    prisma.auditLog
      .create({
        data: {
          action: params.action,
          entityType: params.entityType,
          entityId: params.entityId,
          userId: params.userId,
          metadata: params.metadata ? (params.metadata as Prisma.JsonObject) : undefined,
        },
      })
      .catch((err: unknown) => {
        // eslint-disable-next-line no-console
        console.error("Lỗi ghi AuditLog:", err);
      });
  }

  /**
   * 2. Kiểm tra Khóa sổ Kế toán (Period Lock)
   * Phải được gọi TRƯỚC KHI thực hiện Sửa/Xóa các thực thể tài chính.
   * Ném ra lỗi nếu ngày của bản ghi nằm trong chu kỳ đã khóa.
   */
  static async assertNotPeriodLocked(recordDate: Date) {
    const lockDate = await SystemSettingService.getPeriodLockDate();
    if (lockDate && recordDate <= lockDate) {
      throw new Error(
        `Kỳ kế toán đã bị khóa sổ tính đến ngày ${lockDate.toLocaleDateString()}. Không thể sửa đổi dữ liệu quá khứ.`
      );
    }
  }

  /**
   * 3. Chặn Tồn kho âm (Negative Inventory Guard)
   */
  static assertPositiveInventory(quantityBefore: number, quantityToSubtract: number, productName: string) {
    if (quantityBefore - quantityToSubtract < 0) {
      throw new Error(
        `[Cảnh báo Toàn vẹn] Xuất kho thất bại: Mã "${productName}" chỉ còn ${quantityBefore}, không đủ để xuất ${quantityToSubtract}. Hệ thống chặn xuất âm.`
      );
    }
  }
}

# MSEW: Micro-Step Execution Workflow (Refactor Performance cho Vercel)

> **Gửi Tầng 2 (Coder):** Bỏ thiết kế Map Cache trên RAM đi vì app deploy trên Vercel. Hãy dùng hệ thống Caching gốc của Next.js theo chuẩn code dưới đây.

## Bước 1: Áp dụng Next.js Data Cache cho SystemSettingService
Mở file `src/services/system-setting.service.ts`.
Thay thế toàn bộ nội dung thành:

```typescript
import { prisma } from "@/lib/prisma";
import { unstable_cache, revalidateTag } from "next/cache";

export class SystemSettingService {
  /**
   * Lấy giá trị cấu hình hệ thống (Có Vercel Edge Caching)
   */
  static async get(key: string): Promise<string | null> {
    const getCachedSetting = unstable_cache(
      async (k: string) => {
        const setting = await prisma.systemSetting.findUnique({
          where: { key: k },
        });
        return setting?.value || null;
      },
      [`system-setting-${key}`], // Cache Key
      { tags: ['system-settings', `system-setting-${key}`], revalidate: false } // Revalidate: false nghĩa là cache vĩnh viễn cho đến khi bị tag gọi xóa
    );

    return getCachedSetting(key);
  }

  /**
   * Cập nhật hoặc tạo mới cấu hình hệ thống (Invalidate Vercel Cache)
   */
  static async set(key: string, value: string): Promise<void> {
    await prisma.systemSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });

    // Bắn tín hiệu xóa cache Edge của Vercel ngay lập tức
    revalidateTag(`system-setting-${key}`);
  }

  /**
   * Lấy ngày khóa sổ kế toán (Period Lock Date)
   */
  static async getPeriodLockDate(): Promise<Date | null> {
    const dateStr = await this.get("PERIOD_LOCK_DATE");
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
  }

  /**
   * Thiết lập ngày khóa sổ kế toán
   */
  static async setPeriodLockDate(date: Date): Promise<void> {
    await this.set("PERIOD_LOCK_DATE", date.toISOString());
  }
}
```
*(Ghi chú: Việc dùng `unstable_cache` là API chuẩn mực của Next.js App Router để cache các hàm không dùng `fetch`, cực kỳ tối ưu cho Prisma).*

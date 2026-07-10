# Kế Hoạch Go-Live: Backup, Dịch Chuyển Dữ Liệu & Bảo Mật (SME ERP)

**Vai trò:** DevSecOps & Data Engineer
**Ngày đánh giá:** 2026-07-11

Báo cáo này chứa 3 học phần cực kỳ quan trọng để đảm bảo hệ thống SME ERP lên môi trường Production (Go-Live) một cách an toàn tuyệt đối.

---

## 1. TỰ ĐỘNG HÓA BACKUP DATABASE (Disaster Recovery)

Việc backup dữ liệu hàng ngày là bắt buộc. Script dưới đây sẽ dump database PostgreSQL, nén lại bằng GZIP và đẩy lên AWS S3 (hoặc Google Cloud Storage).

**File:** `scripts/db_backup.sh`
```bash
#!/bin/bash
# Hãy cấp quyền thực thi: chmod +x scripts/db_backup.sh
# Thêm vào crontab (crontab -e): 
# 0 2 * * * /absolute/path/to/scripts/db_backup.sh >> /var/log/db_backup.log 2>&1

set -e # Dừng script ngay nếu có lỗi

# Cấu hình
DB_URL="postgresql://user:password@localhost:5432/sme_erp"
S3_BUCKET="s3://your-company-sme-erp-backups/database"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_DIR="/tmp/sme_erp_backups"
FILE_NAME="sme_erp_backup_${TIMESTAMP}.sql.gz"
FILE_PATH="${BACKUP_DIR}/${FILE_NAME}"

mkdir -p $BACKUP_DIR

echo "[${TIMESTAMP}] Bắt đầu backup database PostgreSQL..."
# Dump và nén ngay lập tức bằng gzip để tiết kiệm dung lượng
pg_dump $DB_URL | gzip > $FILE_PATH

echo "[${TIMESTAMP}] Uploading lên AWS S3..."
# Yêu cầu máy chủ đã cài đặt AWS CLI và chạy `aws configure`
aws s3 cp $FILE_PATH $S3_BUCKET/$FILE_NAME

echo "[${TIMESTAMP}] Xóa file tạm trên local..."
rm -f $FILE_PATH

echo "[${TIMESTAMP}] Backup thành công!"
```

**💡 Xóa file quá 30 ngày:** 
Thay vì viết script xóa thủ công dễ gây rủi ro xóa nhầm, **Best Practice (Chuẩn DevSecOps)** là cấu hình **S3 Bucket Lifecycle Rule**:
1. Vào AWS Console S3 -> Bucket của bạn -> Tab **Management**.
2. Create Lifecycle rule -> Đặt tên: `Auto-delete-30-days`.
3. Tích chọn `Expire current versions of objects`.
4. Nhập số ngày: `30` -> Save. Mọi file cũ sẽ tự động bốc hơi sau 30 ngày mà không tốn tài nguyên server tính toán.

---

## 2. MODULE KHỞI TẠO SỐ DƯ ĐẦU KỲ (Opening Balances)

Khởi tạo dữ liệu đầu kỳ là bước nhạy cảm nhất. Nếu làm bằng tay (nhập kho, tạo đơn bán), doanh thu/giá vốn của kỳ trước sẽ bị tính vào kỳ này làm sai lệch báo cáo P&L. Ta cần một API chạy **Duy nhất 1 lần**.

**File:** `src/app/api/system/opening-balances/route.ts`
```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { authorize } from "@/lib/authorize";
import { InventoryService } from "@/services/inventory.service";
import { TransactionService } from "@/services/transaction.service";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  // DevSecOps: Chỉ Admin cấp cao nhất mới được chạy API này
  await authorize("system.init_balance");

  const body = await req.json();
  const { cashBalances, arBalances, apBalances, inventoryBalances } = body;

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Khởi tạo Tồn kho (Dùng ADJUST_IN để không ghi nhận vào Doanh thu/Chi phí mua hàng)
      for (const inv of inventoryBalances) {
        await InventoryService.recordMovement(tx, {
          type: "IN",
          reason: "ADJUST_IN", // Không dùng PURCHASE_RECEIPT
          productId: inv.productId,
          warehouseId: inv.warehouseId,
          quantity: inv.quantity,
          unitCost: inv.avgCost, // Giá vốn WAC hiện tại
          referenceType: "SYSTEM_INIT",
          referenceId: `init-${inv.productId}-${inv.warehouseId}`,
        });
      }

      // 2. Khởi tạo Số dư Tiền mặt/Ngân hàng
      for (const cash of cashBalances) {
        await TransactionService.recordTransaction(tx, {
          type: "INCOME",
          amount: cash.balance,
          accountId: cash.accountId,
          cashFlowGroup: "FINANCING", // Không đưa vào OPERATIONAL tránh sai P&L
          description: "Khởi tạo số dư đầu kỳ",
        });
      }

      // 3. Khởi tạo Công nợ Phải Thu (AR - Khách hàng)
      for (const ar of arBalances) {
        await tx.invoice.create({
          data: {
            invoiceNumber: `AR-INIT-${ar.customerId}`,
            type: "AR",
            status: "OPEN",
            customerId: ar.customerId,
            totalAmount: ar.balanceDue,
            paidAmount: "0",
            balanceDue: ar.balanceDue, 
            // Không map với SalesOrder nào cả
          }
        });
      }

      // 4. Khởi tạo Công nợ Phải Trả (AP - Nhà cung cấp)
      for (const ap of apBalances) {
        await tx.invoice.create({
          data: {
            invoiceNumber: `AP-INIT-${ap.supplierId}`,
            type: "AP",
            status: "OPEN",
            supplierId: ap.supplierId,
            totalAmount: ap.balanceDue,
            paidAmount: "0",
            balanceDue: ap.balanceDue,
          }
        });
      }
    }, { maxWait: 20000, timeout: 30000 });

    return NextResponse.json({ message: "Khởi tạo số dư thành công" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

---

## 3. KIỂM TRA & GIA CỐ BẢO MẬT (Security Auditing)

Là một hệ thống tài chính ERP, đây là các chốt chặn bảo mật bắt buộc phải có.

### A. Chống Brute-force & DDoS (Rate Limiting)
Sử dụng Upstash Redis `@upstash/ratelimit` để chặn spam API (đặc biệt là Đăng nhập).

**File:** `src/middleware.ts`
```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Chặn tối đa 5 requests / 1 phút cho đăng nhập
const loginRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "1 m"),
});

export async function middleware(request: NextRequest) {
  // 1. Kiểm tra truy cập chưa Login
  const token = request.cookies.get("authjs.session-token")?.value;
  if (!token && !request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // 2. Rate Limit cho API Login
  if (request.nextUrl.pathname === "/api/auth/callback/credentials") {
    const ip = request.ip ?? '127.0.0.1';
    const { success } = await loginRateLimit.limit(ip);
    
    if (!success) {
      return new NextResponse("Too Many Requests. Tài khoản tạm khóa.", { status: 429 });
    }
  }

  // 3. Security Headers chống XSS & Clickjacking
  const response = NextResponse.next();
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

### B. Chống IDOR (Insecure Direct Object Reference)
Khi lấy thông tin đơn hàng, đừng chỉ tin tưởng ID truyền lên URL (`/api/orders/123`), vì hacker có thể thay số `123` thành `124` để xem trộm đơn của người khác. Hãy luôn kèm theo điều kiện xác thực chủ sở hữu hoặc phân quyền.

```typescript
// ❌ SAI: Hacker đổi ID là lấy được đơn của chi nhánh khác
const order = await prisma.salesOrder.findUnique({ where: { id: req.query.id } });

// ✅ ĐÚNG: Chặn IDOR bằng cách ghép thêm tenantId hoặc quyền quản lý
const order = await prisma.salesOrder.findFirst({ 
  where: { 
    id: req.query.id,
    // Nếu là nhân viên Sale, chỉ được xem đơn do mình phụ trách
    ...(session.user.role === 'SALE' ? { salespersonId: session.user.id } : {})
  } 
});

if (!order) throw new Error("Không tìm thấy đơn hàng hoặc bạn không có quyền xem");
```

### C. Zod Data Validation chống XSS và Injection
Đặc biệt cẩn thận với trường `description` hoặc `note` do người dùng nhập vào. Nếu người dùng nhập tag `<script>`, nó có thể kích hoạt XSS trên Dashboard Kế toán.

```typescript
import { z } from "zod";
import sanitizeHtml from "sanitize-html"; // Cài thêm: npm i sanitize-html

// Tự động strip bỏ thẻ HTML độc hại trước khi đưa vào Database
const safeString = z.string().transform((val) => sanitizeHtml(val, {
  allowedTags: [], // Cấm sạch mọi tag HTML
  allowedAttributes: {}
}));

export const createOrderSchema = z.object({
  customerId: z.string().cuid("ID Khách hàng không hợp lệ"), // Chặn SQL Injection từ ID lạ
  note: safeString.optional(),
  items: z.array(z.object({
    productId: z.string().cuid(),
    qty: z.number().int().positive("Số lượng phải lớn hơn 0"), // Chặn Bug số lượng âm
  })).min(1, "Phải có ít nhất 1 sản phẩm")
});
```

### D. Security Cookies config
Trong `next.config.ts`, tuy Next.js đã mặc định cấu hình Cookies khá an toàn, nhưng đối với app ERP, bạn nên bổ sung các header mặc định:

**File:** `next.config.ts`
```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};
export default nextConfig;
```

---
**Tổng Kết:** Bằng cách áp dụng các Module trên, hệ thống ERP của bạn đã sẵn sàng đối phó với thảm họa (Disaster Recovery), làm sạch Dữ liệu đầu kỳ chuẩn Kế toán, và chống chịu được các đợt tấn công nguy hiểm vào Data/API. Hãy import những file này vào mã nguồn và chạy test trước khi Go-Live nhé!

# Workflow Chuẩn Bị Go-Live & Bảo Mật (Dành Cho AI Coding Agent)

**Mục tiêu:** Thực thi các tác vụ chuẩn bị Go-Live bao gồm thiết lập Backup, viết API Khởi tạo số dư đầu kỳ (Opening Balances) và gia cố bảo mật (Security Hardening).

---

## 🔴 CẢNH BÁO BẮT BUỘC DÀNH CHO AI AGENT (CRITICAL RULES):
1. **Làm cẩn thận & Chắc chắn:** Bạn đang thao tác trên dự án ERP chuẩn bị Go-Live. Tuyệt đối KHÔNG ĐƯỢC phá vỡ các chức năng hiện có. Phải đọc kỹ code cũ trước khi sửa.
2. **Không phát sinh nợ kỹ thuật (Technical Debt):** Code viết ra phải clean, type-safe (TypeScript strict mode), không dùng `any` bừa bãi.
3. **Không báo cáo ảo (No Hallucination):** Nếu bạn gặp lỗi khi compile (`npm run build`) hoặc typecheck, HÃY SỬA LỖI ĐÓ. Tuyệt đối KHÔNG báo cáo "đã hoàn thành" nếu code chưa thực sự chạy được. 
4. **Luôn chạy test:** Bắt buộc chạy lệnh `npm run build` sau khi code xong mỗi Phase để đảm bảo an toàn tuyệt đối.

---

## Phase 1: Tạo Script Tự Động Backup Database
**Tập tin mục tiêu:** `scripts/db_backup.sh`

**Nhiệm vụ:**
1. Tạo thư mục `scripts` ở thư mục gốc của dự án nếu chưa có.
2. Viết file `db_backup.sh` chứa Bash Script thực hiện `pg_dump` cơ sở dữ liệu PostgreSQL.
3. Yêu cầu script phải nén bằng `gzip` ngay sau khi dump, tên file chứa timestamp (`YYYY-MM-DD`).
4. (Tùy chọn) Thêm đoạn echo hướng dẫn người dùng cách add script này vào Linux Crontab.

---

## Phase 2: Viết API Khởi Tạo Số Dư Đầu Kỳ (Opening Balances)
**Tập tin mục tiêu:** `src/app/api/system/opening-balances/route.ts`

**Nhiệm vụ:**
1. Tạo cấu trúc thư mục API route.
2. Viết hàm `POST` nhận JSON body chứa 4 mảng: `cashBalances`, `arBalances`, `apBalances`, `inventoryBalances`.
3. Yêu cầu: **Bắt buộc** bọc toàn bộ quá trình insert trong `prisma.$transaction`.
4. **Quy tắc ghi dữ liệu (Single Source of Truth):**
   - Tồn kho: Gọi `InventoryService.recordMovement` với `type: "IN"`, `reason: "ADJUST_IN"` (Tuyệt đối không dùng PURCHASE_RECEIPT).
   - Quỹ tiền: Gọi `TransactionService.recordTransaction` với `type: "INCOME"`, `cashFlowGroup: "FINANCING"`.
   - Công nợ: Create thẳng vào bảng `Invoice` (AR cho khách hàng, AP cho nhà cung cấp). Không liên kết với SalesOrder hay PurchaseOrder.
5. Bảo mật: Bắt buộc gọi `await authorize("system.init_balance")` trước khi thực thi transaction để chặn người lạ gọi API này.

---

## Phase 3: Gia Cố Bảo Mật (Security Hardening)
**Nhiệm vụ 3.1: Security Headers**
- Mở `next.config.ts`.
- Bổ sung cấu hình `headers()` bao gồm: `X-XSS-Protection`, `Referrer-Policy`, `X-Content-Type-Options` và `Strict-Transport-Security`.

**Nhiệm vụ 3.2: Middleware Rate Limiting & Auth Choke**
- Mở `src/middleware.ts` (hoặc tạo mới nếu chưa có).
- Bổ sung logic chặn truy cập nếu request chưa có cookie session (trừ `/login`).
- Tích hợp package `@upstash/ratelimit` để chặn spam gọi API `/api/auth/callback/credentials` (Rate Limit: 5 requests / phút / IP). (Nhớ nhắc người dùng cài package nếu cần).

**Nhiệm vụ 3.3: Data Validation (XSS Prevention)**
- Kiểm tra các file schema Zod hiện tại (vd: `src/lib/validations/order.ts`).
- Bổ sung bộ lọc chống XSS (`sanitize-html` hoặc regex) cho các trường text nhập tay như `note`, `description`. Đảm bảo không ai chèn được `<script>` tags vào dữ liệu.

---
**Nhiệm vụ cuối cùng của AI Agent:** 
Chạy `npm run build`. Nếu build thành công, hãy đưa ra báo cáo tóm tắt các file đã sửa. Nếu lỗi, hãy tự khắc phục cho đến khi build Pass 100%.

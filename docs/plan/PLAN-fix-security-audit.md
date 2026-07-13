# Kế Hoạch Khắc Phục Lỗ Hổng Bảo Mật (Post-Pentest)

## 1. Tóm tắt tình trạng
Qua rà soát mã nguồn (codebase) dựa trên 2 báo cáo `PENTEST_REPORT_DYNAMIC_VIETTUNG.md` và `PENTEST_REPORT_GO_LIVE_AUDIT.md`, tôi xác nhận **toàn bộ các lỗ hổng được nêu là CÓ THẬT và RẤT NGHIÊM TRỌNG**. Hệ thống đang đối mặt với các nguy cơ thực tế:
- Bị ghi khống dòng tiền (do hàm debug không kiểm tra đăng nhập).
- Lộ lọt dữ liệu kinh doanh (IDOR xem đơn hàng của người khác).
- Phá hỏng báo cáo tài chính (Khởi tạo số dư nhiều lần).
- Nguy cơ XSS chéo trang (Thiếu CSP).

## 2. Mục tiêu khắc phục
Khắc phục ngay lập tức 5 lỗ hổng mức độ **CRITICAL** và **HIGH** dễ bị khai thác nhất trước khi hệ thống chính thức Go-Live.

## 3. Các bước thực hiện chi tiết

### Bước 1: Khắc phục CRITICAL - Xóa endpoint Debug
- **Vấn đề:** File `src/app/actions/debug-actions.ts` chứa hàm `testRecordTransaction` ghi trực tiếp giao dịch chi tiền vào DB mà không yêu cầu đăng nhập hay kiểm tra quyền.
- **Giải pháp:** Xóa hoàn toàn file này khỏi hệ thống.

### Bước 2: Khắc phục HIGH - Lỗ hổng IDOR khi xem Đơn hàng
- **Vấn đề:** Trang `src/app/(dashboard)/orders/edit/[id]/page.tsx` cho phép bất kỳ ai có session hợp lệ xem đơn hàng của người khác thông qua URL.
- **Giải pháp:** Thêm `auth()` và `requirePermission(session?.user?.id, "order.view")` vào Server Component trước khi truy vấn đơn hàng từ DB.

### Bước 3: Khắc phục HIGH - Lỗi Idempotency Khởi tạo số dư
- **Vấn đề:** API `/api/system/opening-balances/route.ts` có thể bị chạy lặp lại nhiều lần gây nhân đôi số dư tài khoản và tồn kho.
- **Giải pháp:** Bổ sung cờ `IS_OPENING_BALANCES_DONE` lưu trong bảng `SystemSetting`. Block API nếu cờ này đã bật.

### Bước 4: Khắc phục HIGH - Thiếu Content-Security-Policy (CSP)
- **Vấn đề:** Không có CSP, nguy cơ XSS stored từ các ô input rất cao.
- **Giải pháp:** Thêm header `Content-Security-Policy` chặn script lạ vào mảng headers trong `next.config.ts`.

### Bước 5: Khắc phục HIGH - Thiếu Permission tạo Danh mục thu chi
- **Vấn đề:** Hàm `createTransactionCategory` trong `admin-actions.ts` chỉ kiểm tra `auth()` (có login) mà không check quyền cụ thể.
- **Giải pháp:** Thêm logic `await requirePermission(session.user.id, "cashflow.category.manage")` vào server action.

## 4. Các vấn đề chưa fix trong plan này (Phase 2)
Do giới hạn về thời gian, các task sau cần quy hoạch vào Phase 2 vì đòi hỏi cấu trúc lại nhiều code:
- Rate Limit cho Server Actions (cần tạo wrapper check `X-Forwarded-For`).
- Validate toàn bộ các form nhập liệu bằng Zod schemas thay vì FormData thô.

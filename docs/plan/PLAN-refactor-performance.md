# PLAN: Refactor Hiệu năng & Vercel Caching (Phase 3)

## Kiến trúc tổng quan
Do hệ thống được thiết kế để triển khai lên **Vercel (Serverless)** và cơ sở dữ liệu **Neon (Serverless Postgres)**, thiết kế lưu Cache trên RAM (biến tĩnh static Map) ban đầu sẽ gây ra lỗi nghiêm trọng (Data Inconsistency).

**Vấn đề của Vercel Serverless:**
1. Môi trường Vercel liên tục bật tắt các function instance. Nếu lưu trên RAM, dữ liệu sẽ bị mất liên tục.
2. Nếu có hàng nghìn lượt truy cập, Vercel sẽ bật lên hàng chục instance chạy song song. Mỗi instance có một bộ nhớ RAM riêng. Nếu Admin đổi ngày Khóa sổ ở Instance A, các Instance B, C, D vẫn sẽ đọc ngày Khóa sổ cũ trên RAM của chúng -> Dẫn đến Kế toán vẫn có thể lách luật sửa được hóa đơn!

**Quyết định kiến trúc:**
- Chuyển sang sử dụng tính năng **Data Cache** nguyên bản của Next.js App Router (`unstable_cache` và `revalidateTag`). 
- Vercel Data Cache là một hệ thống Edge Cache dùng chung toàn cầu. Bất kể Vercel có bật lên 100 instance, chúng đều chọc vào chung một bộ đệm Edge này. Giúp Neon DB không bao giờ bị quá tải connections, đồng thời đảm bảo tính đồng nhất tuyệt đối.

## Luồng dữ liệu (Data Flow)
1. User tạo Transaction -> Gọi `SystemSettingService.getPeriodLockDate()`.
2. Service chọc vào Vercel Edge Cache thông qua `unstable_cache`:
   - Nếu có -> Trả về ngay (Siêu tốc).
   - Nếu chưa có -> Query Neon DB -> Lưu kết quả vào Vercel Edge Cache -> Trả về.
3. Khi Admin đổi Ngày khóa sổ -> Gọi `setPeriodLockDate()` -> Update Neon DB -> Bắn lệnh `revalidateTag()` để ra lệnh cho Vercel xóa bỏ cache cũ trên toàn thế giới.

## Danh sách file cần sửa
1. `src/services/system-setting.service.ts` (Tích hợp Next.js Data Cache)

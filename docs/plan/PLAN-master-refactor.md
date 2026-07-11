# PLAN: Chiến dịch Đại phẫu (Master Refactor) Toàn Hệ Thống

## Kiến trúc tổng quan
Việc đập toàn bộ source code ra refactor cùng một lúc (Big Bang Rewrite) là điều tối kỵ trong ngành phần mềm ERP, vì nó sẽ gây tê liệt vận hành và cực kỳ khó kiểm soát bug.

Với tư cách Kiến trúc sư trưởng, tôi quyết định chia chiến dịch "Đại phẫu" này thành 3 Giai đoạn (Phases) áp dụng triệt để nguyên lý rủi ro thấp, hiệu quả cao:

### Phase 1: Móng vuốt Kế Toán (Data Integrity & Core Services)
- Nhúng `AuditAndSecurityHelper` vào 100% các file trong `src/services/` có chứa thao tác thay đổi dữ liệu (`create`, `update`, `delete`).
- Tách (Decouple) "God Class" `order-orchestrator.service.ts` thành các module nhỏ: Fulfillment và Billing.
- Thay thế toàn bộ các vòng lặp `for...of` chứa `await` bên trong `$transaction` thành `createMany` (ví dụ ở API opening-balances).

### Phase 2: Cấu trúc Giao diện (Next.js App Router Best Practices)
- Dời toàn bộ 15 thư mục module (cashflow, products, orders...) vào bên trong thư mục Route Group `src/app/(dashboard)/`.
- Chuyển `Sidebar` từ `RootLayout` sang `(dashboard)/layout.tsx` để giải quyết dứt điểm các lỗi rò rỉ giao diện ở trang Public (Login).

### Phase 3: Tối ưu Hiệu năng (Performance & Cache)
- Áp dụng Redis hoặc Next.js Cache cho các truy vấn `SystemSettingService`.
- Tối ưu hóa các API Báo cáo, tránh Query N+1.

## Luồng dữ liệu thực thi
Chúng ta sẽ không giao cho Tầng 2 làm cả 3 Phase cùng lúc. Sếp hãy bắt đầu bằng việc giao Phase 1 cho nó. Bản vẽ của Phase 1 đã nằm sẵn trong `MSEW-refactor-core-services.md` mà tôi vừa bàn giao ở phiên trước.

# PLAN: Refactor Core Services & Security Integration

## Kiến trúc tổng quan
Sau khi rà soát mã nguồn (Review Code), tôi phát hiện hệ thống đang có 2 "khoản nợ kỹ thuật" (Technical Debt) cực kỳ nghiêm trọng cần được refactor ngay:
1. **Lỗ hổng Khóa sổ Kế toán:** Các dịch vụ cốt lõi như `transaction.service.ts` và `invoice.service.ts` vẫn đang ghi trực tiếp xuống Database mà chưa hề đi qua chốt chặn `Period Lock` (Khóa sổ) và `Audit Log` (Lưu vết) đã được định nghĩa ở Tầng 1. Kế toán hoàn toàn có thể sửa phiếu thu tháng trước!
2. **"God Class" Anti-pattern:** File `order-orchestrator.service.ts` đã phình to quá mức (hơn 16KB). Việc ôm đồm toàn bộ quy trình: Tạo đơn -> Trừ kho -> Sinh hóa đơn -> Gửi webhook vào chung một file sẽ khiến hệ thống không thể bảo trì và test được.

**Quyết định kiến trúc:**
- Áp đặt kỷ luật sắt: 100% các hàm thay đổi dữ liệu tài chính phải đi qua `AuditAndSecurityHelper`.
- Tách (Decouple) Order Orchestrator theo chuẩn Dependency Injection hoặc Pattern Event-Driven (Tách riêng mảng Kho bãi và Kế toán).

## Luồng dữ liệu (Data flow)
1. **Bảo vệ toàn vẹn (Integrity Guard):** Khi gọi `TransactionService.recordTransaction()`, dòng code đầu tiên bắt buộc phải chạy là `await AuditAndSecurityHelper.assertNotPeriodLocked(date)`.
2. **Phân rã Orchestrator:** Thay vì `order-orchestrator` tự thao tác trừ kho, nó sẽ gọi `OrderFulfillmentService` để xuất kho, và gọi `OrderBillingService` để quản lý hóa đơn.

## Danh sách các file cần sửa
1. `src/services/transaction.service.ts` (Tích hợp Guard & Audit)
2. `src/services/invoice.service.ts` (Tích hợp Guard & Audit)
3. `src/services/order-orchestrator.service.ts` (Phân rã code)

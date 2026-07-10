# Workflow Nâng Cấp Enterprise-Ready (Dành Cho AI Coding Agent)

**Mục tiêu:** Thực thi các cải tiến về Hiệu năng (Performance), Bảo mật (RBAC & Audit), và Xử lý Bất đồng bộ (Background Jobs) cho hệ thống SME ERP để đạt tiêu chuẩn cấp doanh nghiệp lớn (như VietTung V2).

AI Coding Agent hãy thực hiện tuần tự các Phase dưới đây. Sau mỗi Phase, hãy chạy `npm run build` hoặc `npm run typecheck` để đảm bảo hệ thống không bị lỗi.

---

## Phase 1: Tối Ưu Hiệu Năng & N+1 Query (Performance Tuning)
**Tập tin mục tiêu:** `src/services/report.service.ts`

**Nhiệm vụ:**
1. **Refactor `getProfitLoss`**:
   - Hiện tại hàm này đang sử dụng `prisma.salesOrderItem.findMany` để tải toàn bộ các item có `status: "DELIVERED"` vào RAM và tính toán bằng JavaScript.
   - **Yêu cầu sửa đổi:** Thay thế bằng `prisma.$queryRaw` sử dụng Raw SQL `SUM` và `GROUP BY` để PostgreSQL tự tính toán Doanh thu (`sellTotal`) và Giá vốn (`baseCost * qty`).

2. **Refactor `getSalesReport`**:
   - Hiện tại hàm này gọi `prisma.salesOrder.findMany({ include: { items: true } })` để tính doanh số theo nhân viên (`byPerson`) và theo sản phẩm (`byProduct`).
   - **Yêu cầu sửa đổi:** Tương tự, sử dụng Prisma Aggregation (`groupBy`) hoặc Raw SQL với `SUM` để lấy ra trực tiếp Array dữ liệu đã được gom nhóm (group by `salespersonId` và `productId`). Loại bỏ hoàn toàn vòng lặp JS thủ công.

3. **Cập nhật Database Indexes**:
   - Mở `prisma/schema.prisma`.
   - Tìm model `Transaction` và bổ sung composite index: `@@index([type, cashFlowGroup, date])` để hỗ trợ filter nhanh ở Dashboard.

---

## Phase 2: Áp Dụng Bảo Mật & Lưu Vết (RBAC & Audit Logging)
**Tập tin mục tiêu:** `src/app/actions/*` (ví dụ `order-actions.ts`, `admin-actions.ts`) và `src/services/*`

**Nhiệm vụ:**
1. **Tích hợp RBAC vào Server Actions**:
   - Đảm bảo rằng hàm `authorize` từ `src/lib/authorize.ts` (hoặc `RbacService.checkPermission`) được import vào mọi file Server Actions.
   - Thêm dòng kiểm tra quyền ngay sau khi lấy session cho các thao tác nhạy cảm.
   - *Ví dụ:* Trong `createWarehouseOrder` phải có `await authorize("order.create");`. Trong `cancelOrder` phải có `await authorize("order.cancel");`.

2. **Kích hoạt Audit Logging**:
   - Tạo một hàm tiện ích mới (hoặc viết thẳng vào Server Actions) để ghi log hành động người dùng vào bảng `AuditLog`.
   - Bổ sung việc gọi hàm này vào những nơi thực hiện cập nhật quan trọng (Tạo đơn, Hủy hóa đơn, Xuất/Nhập kho, Cập nhật thông tin khách hàng).
   - *Dữ liệu mẫu:* `action: "CANCEL_ORDER", entityType: "SalesOrder", entityId: so.id, userId: session.user.id`.

---

## Phase 3: Khởi Động Background Jobs (Outbox Worker)
**Tập tin mục tiêu:** Thêm thư mục/file mới `src/workers/outbox-worker.ts` (hoặc cấu hình cronjob/background task cho Next.js).

**Nhiệm vụ:**
1. **Tạo Outbox Worker**:
   - Viết một hàm vòng lặp (vd: `setInterval` hoặc dùng thư viện queue như `bullmq` nếu được yêu cầu) gọi `OutboxService.getPending(prisma, 10, new Date())` định kỳ (ví dụ mỗi 5-10 giây).
   - Duyệt qua mảng trả về và xử lý logic tương ứng với `job.type`.
   - Nếu thành công, gọi `OutboxService.markDone(prisma, job.id)`. Nếu lỗi, gọi `OutboxService.markFailed(prisma, job.id, now, error.message)`.

2. **Đẩy tính toán nặng vào Queue**:
   - Rà soát `src/services/inventory.service.ts` hoặc các chỗ tính toán WAC/Report chốt ngày.
   - Thay vì chạy đồng bộ (gây nghẽn request), chuyển phần logic đó thành một record mới tạo qua `OutboxService.create(tx, { type: "CALC_WAC", payload: {...} })`.
   - Thêm logic xử lý type `"CALC_WAC"` vào Outbox Worker vừa tạo ở trên.

---

## Quy tắc Code (Coding Guidelines) cho AI Agent:
- LUÔN giữ nguyên kiến trúc Pessimistic Locking hiện có (VD: các đoạn `FOR UPDATE` trong `payment.service.ts` hay `inventory.service.ts`). KHÔNG ĐƯỢC làm hỏng logic kiểm soát tương tranh.
- Khi làm việc với `schema.prisma`, sau khi lưu, bạn CẦN chạy `npx prisma format` (tuỳ chọn) hoặc phải chạy `npx prisma generate` và/hoặc push schema (nếu môi trường yêu cầu) để cập nhật Types.
- KHÔNG thay đổi các field có liên quan trực tiếp đến Transaction và Money type. Tiền tệ luôn sử dụng object `Money` từ `domain/money.ts`.
- Luôn kiểm tra lỗi bằng `npm run build` trước khi báo cáo kết quả hoàn thành.

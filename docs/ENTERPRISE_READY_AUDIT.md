# Báo Cáo Rà Soát Kiến Trúc Hệ Thống ERP — Enterprise-Ready (Mô hình VietTung V2)

**Ngày đánh giá:** 2026-07-11
**Phạm vi:** Kiểm soát tương tranh, Hiệu năng cơ sở dữ liệu, Phân quyền bảo mật (RBAC), và Xử lý bất đồng bộ.

---

## 1. KIỂM SOÁT TƯƠNG TRANH (Concurrency & Race Conditions)
**Trạng thái:** ✅ **TỐT (Đạt chuẩn Enterprise)**

**Khảo sát Codebase:**
- **Tồn kho (Overselling):** Trong `src/services/inventory.service.ts` (hàm `recordMovement`), hệ thống đã áp dụng **Pessimistic Locking** thông qua lệnh `$queryRaw` với đuôi `FOR UPDATE`.
- **Thanh toán:** `PaymentService` và `InvoiceService` cũng dùng `FOR UPDATE` để khóa row của `Account` và `Invoice` trước khi thay đổi trạng thái quỹ/công nợ.

**Đánh giá:**
Cách làm này là hoàn toàn chính xác để chống Race Condition ở mức Database. Khi 2 Request cùng đến, Request thứ 2 sẽ phải đứng chờ Request 1 nhả khóa (lock), hoặc sẽ bị timeout.

**Code snippet mẫu hiện đang rất tốt (Nên giữ nguyên làm tiêu chuẩn):**
```typescript
// Pessimistic Lock chống xuất kho âm và sai lệch WAC
const locked = await tx.$queryRaw<Array<{ id: string; quantity: number }>>`
  SELECT "id", "quantity"
  FROM "WarehouseInventory"
  WHERE "warehouseId" = ${warehouseId} AND "productId" = ${productId}
  FOR UPDATE
`;
// Nếu oldQty - xuất < 0 => Throw Error ngay lập tức.
```

---

## 2. TỐI ƯU HIỆU NĂNG & N+1 QUERY (Performance Tuning)
**Trạng thái:** 🔴 **NGHIÊM TRỌNG (Rủi ro Memory Leak & Crash Server)**

**Khảo sát Codebase:**
Khi kiểm tra `src/services/report.service.ts` (ở các hàm như `getProfitLoss` hoặc `getSalesReport`), hệ thống đang **fetch toàn bộ dữ liệu vào RAM** rồi mới dùng vòng lặp JS để tính tổng:

```typescript
// ❌ Báo động đỏ: Load HÀNG TRIỆU đơn hàng và items vào RAM
const orders = await prisma.salesOrder.findMany({
  where: { status: "DELIVERED" },
  include: { items: true }, 
});
```
Với lượng CSDL thực tế, điều này sẽ vắt kiệt RAM của Node.js (V8 có giới hạn heap size) dẫn đến Crash (OOM - Out of Memory). 

**Giải pháp đề xuất:** Đẩy việc tính toán xuống cho Database Engine (PostgreSQL) thông qua Raw SQL Aggregation.

```typescript
// ✅ Thay vì fetch items, hãy tính tổng trực tiếp bằng SQL Aggregate
export async function getProfitLoss(prisma: PrismaClient = defaultPrisma) {
  const result = await prisma.$queryRaw<Array<{ totalRevenue: Prisma.Decimal, totalCogs: Prisma.Decimal }>>`
    SELECT 
      SUM(i."sellTotal") as "totalRevenue",
      SUM(i."baseCost" * i."qty") as "totalCogs"
    FROM "SalesOrderItem" i
    JOIN "SalesOrder" o ON o."id" = i."salesOrderId"
    WHERE o."status" = 'DELIVERED'
  `;
  
  const revenue = result[0]?.totalRevenue || 0;
  const cogs = result[0]?.totalCogs || 0;
  const grossProfit = Number(revenue) - Number(cogs);

  return { revenue, cogs, grossProfit };
}
```

**Về Indexing:** Bảng `Transaction` cần bổ sung **Composite Index** cho các báo cáo: `@@index([type, cashFlowGroup, date])` để filter báo cáo dòng tiền nhanh hơn.

---

## 3. LƯU VẾT & PHÂN QUYỀN (Audit Logging & RBAC)
**Trạng thái:** 🔴 **NGHIÊM TRỌNG (Hổng bảo mật ở tầng Server)**

**Khảo sát Codebase:**
- **Audit Log:** Bảng `AuditLog` đã khai báo trong Schema nhưng **chưa hề được gọi (Insert)** ở bất kỳ Service nào để lưu vết thay đổi.
- **Phân quyền (RBAC):** Trong các Server Actions (`src/app/actions/order-actions.ts`), API mới chỉ gọi `await auth()` để lấy Session, nhưng **BỎ QUÊN** việc kiểm tra quyền truy cập. Một tài khoản nhân viên bất kỳ nếu biết endpoint đều có thể gửi Request Hủy Hóa Đơn (`cancelOrder`).

**Giải pháp đề xuất:**
Hệ thống đã có sẵn hàm `RbacService.checkPermission` (hoặc `authorize` trong `lib/authorize.ts`), bạn **bắt buộc** phải chèn nó vào mọi Server Action (Controller).

```typescript
// src/app/actions/order-actions.ts
import { authorize } from "@/lib/authorize";

export async function cancelOrder(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Chưa đăng nhập");

  // ✅ CHẶN NGAY TẠI CỬA: Chỉ User có quyền 'order.cancel' mới được đi tiếp
  await authorize("order.cancel"); 

  const id = formData.get("id") as string;
  return safeAction(async () => {
    // ... logic hủy đơn

    // ✅ THÊM AUDIT LOG
    await prisma.auditLog.create({
      data: {
        action: "CANCEL_ORDER",
        entityType: "SalesOrder",
        entityId: id,
        userId: session.user.id,
        metadata: { reason: "Khách đổi ý hoặc quản lý huỷ" }
      }
    });
  });
}
```

---

## 4. XỬ LÝ BẤT ĐỒNG BỘ & CÔNG VIỆC NỀN (Background Jobs)
**Trạng thái:** 🟡 **CẢNH BÁO (Có kiến trúc nhưng chưa thực thi)**

**Khảo sát Codebase:**
- Trong mã nguồn có file `outbox.service.ts` định nghĩa bảng `OutboxEvent` sử dụng tính năng `FOR UPDATE SKIP LOCKED`. Đây là một **thiết kế Queue xuất sắc** chuẩn Enterprise trên cơ sở dữ liệu quan hệ. 
- **Tuy nhiên**, hiện tại **không có Worker nào đang chạy** để tiêu thụ queue này. Việc tính toán nặng (Ví dụ: tính giá vốn bình quân gia quyền WAC) hiện đang chạy đồng bộ (synchronous), sẽ làm chậm toàn bộ luồng request tạo phiếu nhập kho.

**Giải pháp đề xuất:**
Cần khởi tạo một cronjob hoặc background worker chạy ngầm trên Node.js để "ăn" các task bất đồng bộ từ OutboxEvent.

```typescript
// src/workers/outbox-worker.ts
import { OutboxService } from "@/services/outbox.service";

async function processOutbox() {
  // Lấy tối đa 10 job chưa xử lý (nhờ SKIP LOCKED, chạy nhiều worker song song không bị trùng)
  const pendingJobs = await OutboxService.getPending(prisma, 10, new Date());
  
  for (const job of pendingJobs) {
    try {
       if (job.type === 'SYNC_FINANCE_ERP') {
          // Thực thi các logic tính toán nặng (VD: đồng bộ báo cáo thuế, chốt sổ P&L)
       }
       // Đánh dấu hoàn thành
       await OutboxService.markDone(prisma, job.id);
    } catch (e) {
       // Đánh dấu lỗi và thử lại (Retry with backoff)
       await OutboxService.markFailed(prisma, job.id, new Date(), e.message);
    }
  }
}

// ✅ Chạy cronjob mỗi giây (hoặc tích hợp BullMQ/Kafka nếu cần Scale lớn hơn nữa)
setInterval(processOutbox, 1000); 
```

---

### 🚀 TỔNG KẾT HÀNH ĐỘNG CHO TEAM DEV:
1. **Kiến trúc Locking:** Tiếp tục duy trì chuẩn Pessimistic Lock (`FOR UPDATE`) hiện tại.
2. **Hiệu năng:** Refactor ngay lập tức các hàm trong `report.service.ts`, thay việc tính toán array trong RAM bằng lệnh `$queryRaw` với SQL Aggregate (`SUM`, `GROUP BY`).
3. **Bảo mật:** Bổ sung ngay `await authorize('tên_quyền')` vào các Server Actions nhạy cảm. Thêm các hook ghi `AuditLog`.
4. **Hậu trường (Background):** Kích hoạt Worker để dọn dẹp hàng đợi `OutboxEvent`. Tách logic tính toán nặng (như WAC) ra khỏi HTTP Request.

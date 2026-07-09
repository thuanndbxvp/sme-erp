# ERP Thương mại SME — Đặc tả chi tiết & Quy trình dev

> Tài liệu bàn giao cho team dev. Đi kèm `PLAN_NEW_ERP_SME.md` (tổng quan + bài học V2).
> Tài liệu này: đặc tả schema, hợp đồng service, chia task chi tiết có tiêu chí nghiệm thu, và quy trình làm việc chặt chẽ.
> Nguyên tắc gốc: **một nguồn sự thật · tính lại trên server · state machine + khóa row · money chính xác · không kế toán kép.**

---

## A. Stack & quy ước kỹ thuật (chốt cứng)

| Hạng mục | Lựa chọn | Ghi chú |
|---|---|---|
| Ngôn ngữ | TypeScript (strict: true) | Không dùng `any` trừ chỗ có lý do ghi rõ |
| Framework | Next.js 15 App Router + React 19 | Server Action cho mutation, Route Handler cho API đọc |
| DB | PostgreSQL 15+ | Cần transaction + `FOR UPDATE` cho tiền/kho |
| ORM | Prisma 6 | Migration bắt buộc, không `db push` lên staging/prod |
| Tiền tệ | `decimal.js` qua `Money` util | DB `Decimal(15,2)`. CẤM `number` cho tiền |
| Test | Jest + ts-jest, prismaMock | Bắt buộc cho luồng tiền/kho/trạng thái |
| Auth | NextAuth (DB session) | RBAC load từ DB mỗi request |
| Style code | ESLint + Prettier | CI chặn nếu lint fail |
| Log | Pino (`@/lib/logger`) | Cấm `console.*` trong code sản phẩm; cấm ghi file trong request |

**Quy ước đặt tên:**
- Service: `<entity>.service.ts`, export class + method tĩnh hoặc instance rõ ràng.
- DTO/validation: `zod` schema tại `src/lib/validations/<entity>.ts`; input mọi action/route PHẢI qua zod.
- Money field: đơn giá = `*Price`, tổng dòng = `*Total`, thành tiền = `*Amount`. Không lẫn.
- Enum: đặt ở `prisma/schema.prisma` + mirror hằng số ở `src/domain/constants.ts` (đồng bộ, có test kiểm khớp).

**Cấu trúc thư mục:**
```
src/
  app/                # routes, server actions (chỉ validate + gọi service)
  services/           # TOÀN BỘ business logic
  domain/             # constants, state-machine, money, payment-status
  lib/                # prisma, auth, logger, validations, utils
  components/         # UI
  __tests__/          # test
prisma/
  schema.prisma
  migrations/
  seed.ts
```

---

## B. Mô hình dữ liệu chi tiết (Prisma sketch)

Chỉ nêu field quan trọng + ràng buộc. Bổ sung `id/createdAt/updatedAt` mặc định cho mọi model.

```prisma
// ===== DANH MỤC =====
model Product {
  id        String  @id @default(cuid())
  sku       String  @unique
  name      String
  unit      String
  buyPrice  Decimal @db.Decimal(15,2) @default(0)  // giá nhập gần nhất (tham chiếu)
  sellPrice Decimal @db.Decimal(15,2) @default(0)
  isActive  Boolean @default(true)
}
model Customer { id String @id @default(cuid()); name String; phone String? ; email String?; creditLimit Decimal @db.Decimal(15,2) @default(0); isActive Boolean @default(true) }
model Supplier { id String @id @default(cuid()); name String; phone String?; isActive Boolean @default(true) }
model Warehouse { id String @id @default(cuid()); code String @unique; name String; isActive Boolean @default(true) }
model Account { // quỹ tiền mặt / ngân hàng
  id String @id @default(cuid()); code String @unique; name String
  balance Decimal @db.Decimal(15,2) @default(0)   // NGUỒN SỰ THẬT số dư tiền
  isActive Boolean @default(true)
}

// ===== KHO =====
model WarehouseInventory {
  id String @id @default(cuid())
  warehouseId String; productId String
  quantity Int @default(0)
  avgCost  Decimal @db.Decimal(15,2) @default(0)  // WAC per unit
  batchNumber String?; expiryDate DateTime?
  @@unique([warehouseId, productId, batchNumber])
}
model InventoryMovement { // event table — nguồn COGS/tồn
  id String @id @default(cuid())
  type String   // IN | OUT
  reason String // PURCHASE_RECEIPT | SALES_SHIPMENT | RETURN_* | ADJUST_* | DROPSHIP_*
  productId String; warehouseId String?
  quantity Int; unitCost Decimal @db.Decimal(15,2); totalCost Decimal @db.Decimal(15,2)
  referenceType String; referenceId String
  createdAt DateTime @default(now())
  @@index([productId]); @@index([referenceType, referenceId])
}

// ===== ĐƠN HÀNG =====
enum OrderStatus { PENDING DELIVERED CANCELLED }
enum PurchaseStatus { ORDERED RECEIVED CANCELLED }
enum FulfillmentType { WAREHOUSE DROPSHIP }
enum PaymentStatus { UNPAID PARTIAL PAID }

model SalesOrder {
  id String @id @default(cuid())
  orderCode String @unique
  status OrderStatus @default(PENDING)
  paymentStatus PaymentStatus @default(UNPAID)   // DERIVE từ Invoice, không set tay từ client
  fulfillmentType FulfillmentType @default(WAREHOUSE)
  customerId String                              // BẮT BUỘC (FK)
  warehouseId String?
  linkedPurchaseOrderId String? @unique          // dropship
  salespersonId String?                          // người bán → hoa hồng (khác userId người tạo)
  userId String?                                 // người tạo
  saleDate DateTime?; deliveredDate DateTime?
  totalAmount Decimal @db.Decimal(15,2) @default(0)
  taxAmount   Decimal @db.Decimal(15,2) @default(0)
  @@index([status]); @@index([customerId, status])
}
model SalesOrderItem {
  id String @id @default(cuid()); salesOrderId String
  productId String?; productName String; unit String; qty Int
  sellPrice Decimal @db.Decimal(15,2)            // đơn giá
  sellTotal Decimal @db.Decimal(15,2)            // = sellPrice * qty (thành tiền dòng, chưa thuế)
  baseCost  Decimal @db.Decimal(15,2)            // ĐƠN GIÁ vốn/unit (quy ước rõ, không lẫn tổng)
  profit    Decimal @db.Decimal(15,2)            // chốt lúc giao — báo cáo lãi dùng field này
  taxAmount Decimal @db.Decimal(15,2) @default(0)
}
// PurchaseOrder / PurchaseOrderItem: cấu trúc tương tự (buyPrice/buyTotal), status PurchaseStatus.

// ===== TIỀN & CÔNG NỢ =====
enum TransactionType { INCOME EXPENSE }
model Transaction {
  id String @id @default(cuid())
  date DateTime @default(now())
  type TransactionType
  amount Decimal @db.Decimal(15,2)
  accountId String                               // FK Account
  cashFlowGroup String @default("OPERATIONAL")   // OPERATIONAL | INVESTING | FINANCING
  customerId String?; supplierId String?
  salesOrderId String?; purchaseOrderId String?
  description String?
  @@index([accountId]); @@index([date])
}
enum InvoiceType { AR AP }
enum InvoiceStatus { OPEN PARTIAL PAID CANCELLED }
model Invoice {
  id String @id @default(cuid())
  invoiceNumber String @unique
  type InvoiceType
  status InvoiceStatus @default(OPEN)
  customerId String?; supplierId String?
  salesOrderId String? @unique; purchaseOrderId String? @unique
  totalAmount Decimal @db.Decimal(15,2)
  paidAmount  Decimal @db.Decimal(15,2) @default(0)   // NGUỒN SỰ THẬT công nợ
  balanceDue  Decimal @db.Decimal(15,2)
}
model Payment { id String @id @default(cuid()); direction String; amount Decimal @db.Decimal(15,2); accountId String; ... }
model PaymentApplication { id String @id @default(cuid()); paymentId String; invoiceId String; appliedAmount Decimal @db.Decimal(15,2) }

// ===== HOA HỒNG / NHÂN VIÊN / HẠ TẦNG =====
model CommissionRule { id String @id @default(cuid()); ... }
model Payout { id String @id @default(cuid()); userId String; periodMonth Int; periodYear Int; commission Decimal; status String; @@unique([userId, periodMonth, periodYear]) }
model EmployeeTransaction { id String @id @default(cuid()); userId String; type String; amount Decimal; ... } // tạm ứng/hoàn ứng
model OutboxEvent { id String @id @default(cuid()); type String; payload Json; status String @default("PENDING"); attempts Int @default(0); nextRetryAt DateTime?; lockedUntil DateTime?; idempotencyKey String? }
model AuditLog { id String @id @default(cuid()); action String; entityType String; entityId String; userId String; createdAt DateTime @default(now()) }
model User { id String @id @default(cuid()); email String @unique; passwordHash String; roleId String?; ... }
model Role { id String @id @default(cuid()); name String @unique }
model Permission { id String @id; code String @unique }
```

---

## C. Hợp đồng service & bất biến nghiệp vụ (invariants)

Mỗi service phải đảm bảo các bất biến sau. Đây là thứ QA/reviewer kiểm, và là nội dung test bắt buộc.

### C1. InventoryService.recordMovement(tx, input)
- Trong 1 transaction, `SELECT ... FOR UPDATE` row `WarehouseInventory` trước khi đọc/ghi.
- OUT làm `quantity` âm → **throw** "Kho không đủ hàng" (chặn oversell).
- IN có `unitCost` → tính lại `avgCost = (oldQty*oldCost + inQty*unitCost) / newQty`.
- Ghi 1 `InventoryMovement`. Idempotent theo `(referenceType, referenceId, reason)` khi cần.

### C2. TransactionService.create(tx, input)
- `SELECT ... FOR UPDATE` account trước khi cập nhật `balance`.
- INCOME → `balance += amount`; EXPENSE → `balance -= amount`. Dùng `Money`, không float.
- OUTFLOW vượt số dư (nếu bật kiểm) → throw.

### C3. Thanh toán & công nợ (invariant tối cao)
- **Invoice là nguồn sự thật công nợ.** `balanceDue = totalAmount - paidAmount`, luôn ≥ 0.
- `Order.paymentStatus` = `computePaymentStatus(paidAmount, totalAmount)` — DERIVE, không set từ client.
- Ghi Payment → cập nhật Invoice → cập nhật `Account.balance` → derive lại `Order.paymentStatus`, TẤT CẢ trong 1 transaction.
- Hủy đơn → Invoice `CANCELLED`, `paidAmount=0`, order về `UNPAID`; hoàn tiền tạo Transaction ngược dấu đúng chiều.

### C4. State machine trạng thái đơn
- `SalesOrder`: `PENDING → {DELIVERED, CANCELLED}`, `DELIVERED → {CANCELLED}`, `CANCELLED → {}`.
- `PurchaseOrder`: `ORDERED → {RECEIVED, CANCELLED}`, `RECEIVED → {CANCELLED}`, `CANCELLED → {}`.
- `updateStatus` PHẢI `SELECT ... FOR UPDATE` order row, validate transition, ghi history, rồi mới side-effect.
- Chuyển trạng thái không hợp lệ → throw, không âm thầm bỏ qua.

### C5. OrderOrchestrator (tạo/sửa đơn)
- Toàn bộ tạo đơn (SO + PO dropship + payment + inventory) trong 1 `prisma.$transaction`.
- DROPSHIP: tạo PO trước (status ORDERED), tạo SO link `linkedPurchaseOrderId`, side-effect kho khi DELIVERED.
- Hủy SO dropship phải đồng bộ PO liên kết (không để PO treo).
- Không sửa đơn đã DELIVERED/RECEIVED (yêu cầu quy trình trả hàng).

### C6. CommissionService
- Key theo `salespersonId` (fallback `userId` cho đơn cũ), chỉ tính đơn `DELIVERED`.
- Payout idempotent theo `@@unique([userId, periodMonth, periodYear])` (bắt P2002).
- Hủy đơn sau khi đã tính hoa hồng → phải trừ lại (không double-count).

### C7. Outbox
- `getPending` dùng `FOR UPDATE SKIP LOCKED` + `lockedUntil`.
- Retry backoff, dead-letter sau N lần. Handler idempotent (check đã xử lý trước khi làm).

---

## D. Chia task chi tiết (mỗi task = 1 PR, có Acceptance Criteria)

Ký hiệu: **AC** = tiêu chí nghiệm thu (phải verify bằng bằng chứng, không tự nhận).

### PHASE 0 — Nền tảng
- **P0-1 Khởi tạo dự án**: Next.js+TS strict, ESLint/Prettier, cấu trúc thư mục, CI (typecheck+lint+test). **AC:** `npm run build` + CI xanh trên repo rỗng.
- **P0-2 Prisma + DB core**: schema danh mục + hạ tầng (User/Role/Permission/Account/Product/Customer/Supplier/Warehouse/OutboxEvent/AuditLog), migration, seed. **AC:** `prisma migrate dev` chạy sạch; seed tạo được 1 admin + vài danh mục.
- **P0-3 Money util**: `src/domain/money.ts` (add/sub/mul/compare, from/to Decimal). **AC:** test 0.1+0.2=0.3, không sai số.
- **P0-4 Auth + RBAC**: NextAuth DB session, `checkPermission`, deny-all khi không role. **AC:** test user không quyền bị chặn ở server action.
- **P0-5 State-machine util + Outbox util**: generic `assertTransition(map, from, to)`; Outbox create/getPending/markDone/markFailed. **AC:** test transition hợp lệ/không hợp lệ; test SKIP LOCKED (integration).

### PHASE 1 — Danh mục & Kho
- **P1-1 CRUD danh mục** (Product/Customer/Supplier/Warehouse/Account): action + zod + UI list/form. **AC:** tạo/sửa/xóa mềm hoạt động; validation chặn input xấu.
- **P1-2 recordMovement (C1)**: khóa row, chặn tồn âm, WAC. **AC:** test oversell throw; test WAC đúng qua 2 lần nhập giá khác nhau.
- **P1-3 FEFO**: chọn lô hết hạn trước, fallback lô không hạn. **AC:** test chọn đúng lô theo expiry.
- **P1-4 Báo cáo tồn kho**: tồn theo sản phẩm/kho + giá trị tồn (qty*avgCost). **AC:** khớp seed tính tay.

### PHASE 2 — Đơn hàng
- **P2-1 SO/PO service + state machine (C4)**: tạo/đọc, updateStatus có FOR UPDATE + validateTransition. **AC:** test chuyển trạng thái hợp lệ/không; test race 2 request đồng thời không double side-effect.
- **P2-2 Orchestrator tạo đơn (C5)**: WAREHOUSE + DROPSHIP trong 1 transaction. **AC:** tạo đơn 2 loại thành công; rollback nguyên vẹn khi 1 bước lỗi.
- **P2-3 Giao hàng (side-effect kho)**: DELIVERED → xuất kho (WAREHOUSE) / movement ảo (DROPSHIP) qua outbox. **AC:** tồn giảm đúng; idempotent khi retry.
- **P2-4 Hủy đơn**: đồng bộ kho (hoàn) + Invoice + hoàn tiền đúng dấu + đồng bộ PO dropship. **AC:** test hủy mỗi loại đơn; số dư quỹ + tồn + công nợ trở về đúng.

### PHASE 3 — Tiền, công nợ
- **P3-1 TransactionService (C2)**: cập nhật balance atomic. **AC:** test INCOME/EXPENSE đổi số dư đúng chiều, có lock.
- **P3-2 Invoice + Payment + Application (C3)**: recordPayment cập nhật invoice+balance+derive paymentStatus, 1 transaction. **AC:** test thu đủ→PAID, thu một phần→PARTIAL, chi NCC; balanceDue≥0; không tin client.
- **P3-3 Đối soát thu/chi ↔ đơn**: lock trước khi tính, không thu trùng. **AC:** test đối soát N-N không vượt tổng.

### PHASE 4 — Báo cáo
- **P4-1 P&L** (từ SalesOrderItem.profit + chi phí Transaction/DirectExpense). **AC:** khớp baseline tính tay trên seed.
- **P4-2 Sổ quỹ/Dòng tiền** (từ Transaction theo Account; closing = Account.balance). **AC:** closing khớp Account.balance.
- **P4-3 Công nợ AR/AP** (từ Invoice.balanceDue). **AC:** tổng khớp baseline.
- **P4-4 Bán hàng theo NV/SP**. **AC:** tổng doanh thu khớp P&L.

### PHASE 5 — Hoa hồng & Quỹ NV
- **P5-1 Commission (C6)**: rule + payout idempotent, chỉ đơn DELIVERED. **AC:** test không double-count khi hủy đơn.
- **P5-2 EmployeeTransaction**: tạm ứng/hoàn ứng, khóa số dư. **AC:** test số dư quỹ NV không âm ngoài ý muốn.

### PHASE 6 — Hoàn thiện
- **P6-1 Dashboard + Notification**; **P6-2 Audit UI + phân quyền chi tiết**; **P6-3 Hardening** (rate limit, validation soát lại, security review); **P6-4 Seed demo + tài liệu người dùng**. **AC:** security checklist pass; demo end-to-end.

---

## E. Quy trình làm việc của team (chặt chẽ)

### E1. Git & branch
- `main` luôn deploy được. Không commit thẳng vào `main`.
- Nhánh theo task: `feat/P2-2-orchestrator`, `fix/...`. 1 task = 1 nhánh = 1 PR.
- Commit quy ước: `type(scope): mô tả [P2-2]` (type: feat/fix/refactor/test/chore).
- Không force-push nhánh chung; không `reset --hard` nhánh người khác.

### E2. Vòng đời 1 task (bắt buộc theo)
1. **Nhận task** từ bảng (Mục D), đọc AC + invariant liên quan (Mục C).
2. **Nhánh mới** từ `main` cập nhật.
3. **Viết test trước hoặc song song** cho AC (đặc biệt luồng tiền/kho/trạng thái).
4. **Code** — chỉ đụng file trong phạm vi task.
5. **Self-check 3 gate**: `tsc --noEmit` 0 lỗi · `lint` 0 lỗi · `jest` phần liên quan xanh. Dán output vào PR.
6. **PR** với mô tả: task, thay đổi, cách test, AC nào đã verify + bằng chứng.
7. **Review** ≥1 người: kiểm invariant + AC, không chỉ đọc code.
8. **Merge** khi CI xanh + review approve. Squash merge.

### E3. Definition of Done (một task chỉ "xong" khi ĐỦ)
- [ ] Code chạy, `tsc`+`lint`+`test` xanh (có output kèm PR).
- [ ] AC của task được verify bằng bằng chứng thật (test pass / query DB / screenshot).
- [ ] Luồng tiền/kho/trạng thái: có test HÀNH VI chứng minh số đổi đúng, không chỉ compile.
- [ ] Không phá test cũ (chạy full suite trước merge).
- [ ] Không secret/log rác/`console.*`/ghi file trong request.
- [ ] Migration (nếu có) sinh bằng Prisma, review được, không sửa SQL tay ẩu.
- [ ] Cập nhật tài liệu nếu đổi hợp đồng service.

### E4. Quy tắc "không báo cáo ảo" (kỷ luật cốt lõi)
- Cấm nói "đã xong/đã test" mà không có output.
- Cấm "should work / có lẽ đúng". Chỉ khẳng định điều quan sát được.
- Test có sẵn fail: phải xác định fail đó là do mình hay có sẵn (dùng `git stash` chạy đối chứng), ghi rõ trong PR.
- Nếu bị chặn (thiếu env/DB), nói thẳng "chưa verify được vì X", không giả vờ xanh.

### E5. Quy tắc "không sửa chỗ này hỏng chỗ khác"
- Trước khi đổi/xóa symbol dùng chung: grep toàn repo, liệt kê nơi dùng trong PR.
- Đổi schema/enum/hợp đồng service: thông báo team, cập nhật mọi nơi tham chiếu trong cùng PR.
- Đổi trạng thái/tiền/kho: luôn trong transaction + lock; không tách thành nhiều request client điều phối.
- PR chạm > ~8 file hoặc > ~400 dòng: tách nhỏ hoặc giải trình rõ.

### E6. Điểm dừng phải hỏi (không tự quyết)
- Thay đổi ảnh hưởng nhiều module hoặc đổi hợp đồng service dùng chung.
- Migration drop/đổi cột trên DB có dữ liệu thật (backup trước, xác nhận lead).
- Một cách đã thử fail 2 lần → dừng, phân tích gốc rễ, đổi hướng (không vá lần 3).
- Phát sinh ngoài phạm vi task → ghi lại, không tự mở rộng.

### E7. Môi trường & CI
- `.env` không commit; dùng `.env.example`. Secret qua biến môi trường của hạ tầng.
- CI chạy: install → `tsc --noEmit` → `lint` → `test` → `build`. Đỏ bất kỳ bước nào = chặn merge.
- Migration chạy có kiểm soát trên staging trước prod. Có backup DB trước migration prod.

---

## F. Test & nghiệm thu tài chính (bắt buộc)
- Mỗi phase có **baseline tính tay** trên seed data (script đọc bảng vận hành), báo cáo phải khớp baseline — KHÔNG so với chính output cũ của app (tránh xanh giả).
- Ma trận test tối thiểu cho luồng tiền/kho/trạng thái:
  - Thu/chi → số dư Account đổi đúng chiều + đúng số.
  - Thanh toán một phần/đủ → paymentStatus đúng, balanceDue≥0.
  - Hủy đơn đã thu tiền → hoàn tiền, số dư/tồn/công nợ về đúng.
  - Bán quá tồn → bị chặn.
  - Hoa hồng khi hủy đơn → trừ lại, không double.
  - Chuyển trạng thái sai luật → bị chặn.

## G. Bàn giao & khởi động
1. Lead dựng repo + P0-1..P0-5 làm mẫu (chuẩn code + test + PR mẫu để team noi theo).
2. Chia task theo phase; Phase 1–3 là lõi, ưu tiên chất lượng hơn tốc độ.
3. Mỗi tuần: demo luồng thật + review nợ kỹ thuật.
4. Không sang phase sau khi phase trước chưa đạt Definition of Done toàn bộ task lõi.

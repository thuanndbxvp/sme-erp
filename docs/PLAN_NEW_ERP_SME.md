# Kế hoạch xây dựng ERP thương mại SME (greenfield)

> Bản kế hoạch cho app ERP mới, chuyên nghiệp vụ **thương mại (mua–bán–kho–công nợ–dòng tiền–hoa hồng)** cho doanh nghiệp siêu nhỏ/nhỏ. Kế thừa bài học từ VietTung V2.
> Vai trò người viết: Tech Lead. Nguyên tắc xuyên suốt: **đơn giản đúng mức, không over-engineer, mọi con số tài chính truy ngược được về chứng từ vận hành.**

---

## 0. Bài học rút từ VietTung V2 (định hình mọi quyết định dưới đây)

Những điều V2 làm SAI hoặc trả giá đắt — app mới phải tránh từ ngày 1:

1. **Xây kế toán kép (double-entry JE) cho SME là over-engineering.** V2 dựng cả engine Journal Entry theo TT133, rồi phải gỡ ra đau đớn (stub no-op, báo cáo đọc bảng rỗng, ~600 dòng dead code). → **App mới KHÔNG có sổ kế toán kép.** Số liệu tài chính tính trực tiếp từ chứng từ vận hành (đơn hàng, giao dịch, hóa đơn, tồn kho).
2. **Hai nguồn sự thật cho cùng một dữ liệu.** V2 vừa có `Invoice.paidAmount` vừa có `Order.paymentStatus` — không đồng bộ, gây công nợ sai. → **Mỗi dữ kiện có đúng MỘT nguồn sự thật.**
3. **Tin dữ liệu client gửi lên.** V2 lấy `paymentStatus` thẳng từ payload → gian lận/sai. → **Luôn tính lại trạng thái từ số tiền/số lượng thực trên server.**
4. **Trạng thái không được kiểm soát.** `validateTransition` rỗng, `updateOrderStatus` không khóa row → race, chuyển trạng thái lung tung. → **State machine tường minh + khóa row khi đổi trạng thái.**
5. **`baseCost` không nhất quán** (lúc đơn giá, lúc tổng dòng) → COGS phình. → **Quy ước rõ: field nào là đơn giá, field nào là tổng; validate lúc ghi.**
6. **Debug leak trong transaction** (`appendFileSync`), `console.log` rải rác, script/mật khẩu hardcode ở root. → **Logger chuẩn từ đầu, không ghi file trong request, không commit secret.**
7. **Enum phình rồi phải rút gọn** (OrderStatus 6→3, bỏ IMPORT). → **Enum tối giản từ đầu, chỉ thêm khi có nhu cầu thật.**
8. **Money bằng `number` float** ở nhiều path → sai số. → **decimal.js (hoặc integer VND) nhất quán toàn hệ.**
9. **Không có test cho luồng tiền** → bug lọt. → **Test hành vi bắt buộc cho mọi luồng tiền/kho/trạng thái.**

Điều V2 làm ĐÚNG — giữ lại:
- **Outbox pattern** cho side-effect bất đồng bộ (FOR UPDATE SKIP LOCKED + backoff + dead-letter).
- **Kho khóa row + chặn tồn âm** (không oversell).
- **Commission key theo salespersonId** (người bán), không phải người tạo đơn.
- **Feature gate + RBAC** ở tầng server (không chỉ UI).

---

## 1. Phạm vi nghiệp vụ (MVP thương mại SME)

**Trong phạm vi:**
- Danh mục: Sản phẩm, Khách hàng, Nhà cung cấp, Kho, Tài khoản tiền (quỹ/ngân hàng), Nhân viên.
- Đơn bán (Sales Order) + Đơn mua (Purchase Order), 2 hình thức: **WAREHOUSE** (bán từ kho) và **DROPSHIP** (bán thẳng, SO gắn 1 PO). *(Nhập kho thuần = tạo PO độc lập, không cần loại "IMPORT" riêng.)*
- Kho: nhập/xuất theo lô, giá vốn bình quân gia quyền (WAC), xuất FEFO khi có hạn dùng.
- Công nợ: phải thu (khách) / phải trả (NCC) qua Hóa đơn + Thanh toán.
- Dòng tiền / Sổ quỹ: thu–chi thực tế theo từng tài khoản tiền.
- Hoa hồng nhân viên bán hàng; tạm ứng/hoàn ứng quỹ nhân viên.
- Báo cáo: Lỗ lãi (P&L), Dòng tiền, Công nợ AR/AP, Tồn kho, Bán hàng theo nhân viên/sản phẩm.

**Ngoài phạm vi (đừng làm):** kế toán kép/sổ cái/bảng cân đối VAS, đa tiền tệ, sản xuất/BOM, đa chi nhánh phức tạp, e-invoice tích hợp thuế (để pha sau nếu cần).

---

## 2. Kiến trúc & stack đề xuất

- **Stack:** Next.js 15 (App Router) + React 19 + TypeScript strict + Prisma 6 + PostgreSQL. (Giữ giống V2 để tái dùng kiến thức, nhưng cấu trúc sạch hơn.)
- **Phân tầng rõ ràng, một chiều:** `UI (client) → Server Action / Route → Service (business logic) → Prisma`. Business logic CHỈ ở Service; Action/Route chỉ validate input + gọi service + trả kết quả. Không rò logic lên Action như V2.
- **Money:** dùng `decimal.js` qua một `Money` util tập trung; DB `Decimal(15,2)`. Cấm `number` cho tiền.
- **Trạng thái:** mọi entity có vòng đời dùng **state machine tường minh** (map `từ → [đến hợp lệ]`), enforce ở service, đổi trạng thái luôn `SELECT FOR UPDATE`.
- **Side-effect bất đồng bộ:** Outbox pattern (bê nguyên thiết kế tốt của V2).
- **Nguồn sự thật tài chính:**
  - Số dư tiền = `Account.balance` (cập nhật atomic khi có Transaction).
  - Công nợ = `Invoice.balanceDue`; `Order.paymentStatus` DERIVE từ Invoice (không lưu song song 2 nguồn).
  - Giá vốn/tồn = `InventoryMovement` + `WarehouseInventory.avgCost` (WAC).
  - Lãi lỗ = từ `SalesOrderItem` (revenue, profit đã chốt) + chi phí (Transaction/DirectExpense).
- **Audit + RBAC + Feature flag** thiết kế ngay từ schema, không pha sau.

---

## 3. Mô hình dữ liệu cốt lõi (tối giản)

Nhóm chính (Prisma models):
- **Danh mục:** `Product`, `Customer`, `Supplier`, `Warehouse`, `Account` (quỹ/bank), `User`, `Role`, `Permission`.
- **Đơn hàng:** `SalesOrder`/`SalesOrderItem`, `PurchaseOrder`/`PurchaseOrderItem`. SO có `fulfillmentType` (WAREHOUSE|DROPSHIP), `linkedPurchaseOrderId` (dropship).
- **Kho:** `WarehouseInventory` (tồn theo lô: qty, avgCost, batch, expiry), `InventoryMovement` (event: IN/OUT + reason).
- **Tiền & công nợ:** `Transaction` (thu/chi, gắn Account + optional customer/supplier/order), `Invoice` (AR/AP, balanceDue), `Payment` + `PaymentApplication` (thanh toán áp vào nhiều hóa đơn).
- **Hoa hồng & nhân viên:** `CommissionRule`, `Payout`, `EmployeeTransaction` (tạm ứng/hoàn ứng).
- **Hạ tầng:** `OutboxEvent`, `AuditLog`, `Notification`, `SystemSetting`.

Enum tối giản (chốt từ đầu):
- `OrderStatus = PENDING | DELIVERED | CANCELLED`
- `PurchaseStatus = ORDERED | RECEIVED | CANCELLED`
- `PaymentStatus = UNPAID | PARTIAL | PAID` (DERIVE từ Invoice)
- `FulfillmentType = WAREHOUSE | DROPSHIP`
- `TransactionType = INCOME | EXPENSE`
- `InvoiceType = AR | AP`; `InvoiceStatus = OPEN | PARTIAL | PAID | CANCELLED` (bỏ OVERDUE — chỉ là nhãn tính từ dueDate)

Quy ước bắt buộc ghi trong schema comment:
- Field tổng dòng (`sellTotal`, `buyTotal`) vs đơn giá (`sellPrice`, `buyPrice`) — tên rõ, không lẫn.
- `SalesOrderItem.profit` chốt lúc giao đơn; báo cáo lãi dùng field này.
- VAT tính ngoài (exclusive); COGS/doanh thu không gồm VAT.

---

## 4. Lộ trình triển khai theo phase (mỗi phase có gate rõ)

**Gate "done" mỗi phase:** `tsc --noEmit` 0 lỗi + `lint` 0 lỗi + `jest` xanh + demo được luồng thật.

### Phase 0 — Nền tảng (1 tuần)
Khởi tạo dự án, Prisma schema core, `Money` util (decimal), logger, cấu trúc thư mục, CI (typecheck+lint+test), seed data mẫu. Auth (NextAuth) + RBAC + Feature flag khung. State-machine util + Outbox util (bê từ V2, viết test).

### Phase 1 — Danh mục & Kho (1–1.5 tuần)
CRUD Product/Customer/Supplier/Warehouse/Account. `InventoryMovement` + `recordMovement` (FOR UPDATE, chặn tồn âm, WAC). FEFO. Báo cáo tồn kho. **Test:** oversell bị chặn, WAC tính đúng, FEFO chọn đúng lô.

### Phase 2 — Đơn hàng (2 tuần)
SO/PO + orchestrator (1 transaction). WAREHOUSE (xuất kho) + DROPSHIP (SO↔PO link). State machine trạng thái đơn + khóa row. Hủy đơn đồng bộ kho + công nợ + hoàn tiền đúng dấu. **Test:** tạo/giao/hủy mọi loại đơn, race đổi trạng thái, hủy dropship đồng bộ PO.

### Phase 3 — Tiền, công nợ, thanh toán (1.5 tuần)
`Transaction` cập nhật `Account.balance` atomic. `Invoice` + `Payment` + `PaymentApplication`. `Order.paymentStatus` derive từ Invoice (1 nguồn). Đối soát thu/chi ↔ đơn. **Test:** thu/chi đổi số dư đúng chiều, công nợ khớp, không thu trùng, không tin client.

### Phase 4 — Báo cáo (1 tuần)
P&L (từ SalesOrderItem + chi phí), Dòng tiền/Sổ quỹ (từ Transaction theo Account), Công nợ AR/AP (từ Invoice), Bán hàng theo NV/SP. **Verify bằng baseline tính tay trên seed data.**

### Phase 5 — Hoa hồng & Quỹ nhân viên (1 tuần)
CommissionRule + Payout (key salespersonId, chỉ đơn DELIVERED, idempotent). EmployeeTransaction tạm ứng/hoàn ứng (khóa số dư). **Test:** hoa hồng không double-count khi hủy đơn, quỹ NV không âm ngoài ý muốn.

### Phase 6 — Hoàn thiện (1 tuần)
Dashboard, Notification, Audit UI, phân quyền chi tiết, seed demo, tài liệu người dùng. Hardening: rate limit, input validation, security review.

**Tổng ước lượng: ~8–9 tuần cho 1–2 dev.**

---

## 5. Quy tắc chất lượng (áp dụng xuyên suốt, giống tinh thần workflow V2)
- 1 task = 1 commit, message quy ước; chỉ commit khi 3 gate xanh.
- Task chạm tiền/kho/trạng thái: verify HÀNH VI (test hoặc query trước/sau), không chỉ compile.
- Không báo "xong" nếu chưa dán output lệnh thật.
- Trước khi xóa/đổi symbol: grep mọi nơi dùng.
- Không secret trong repo; logger thay console; không ghi file trong request.

---

## 6. Rủi ro & giảm thiểu
- **Cám dỗ thêm kế toán kép trở lại:** neo quyết định "SME thuần" ở tài liệu này; nếu khách cần VAS đầy đủ → đó là sản phẩm/tier khác, không nhồi vào MVP.
- **Di trú dữ liệu từ V2:** viết script import có ánh xạ enum + chuẩn hóa field bẩn (baseCost, phone rỗng) — bài học đã có từ V2.
- **Phình phạm vi:** mỗi tính năng ngoài Mục 1 phải được duyệt riêng, mặc định từ chối trong MVP.

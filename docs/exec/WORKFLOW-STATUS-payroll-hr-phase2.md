# Trạng thái Thực thi Workflow (WORKFLOW-STATUS)

## Thông tin Coder (Typist)
- **Typist Signature:** Cursor Tier-2 Engineer (Claude)
- **Ngày thực thi:** `2026-07-13`
- **Bắt đầu lúc:** `09:10`

## Bảng Trạng thái Micro-Steps (Copy từ MSEW)

- [x] **Step 1:** Schema — `Payslip` model (12 fields + @@unique(userId, month, year) + @@index(userId)) + `User.payslips` back-relation.
- [x] **Step 2:** `src/app/actions/hr-actions.ts` — `getDraftPayslip(userId, month, year)` (server-side compute) + `finalizePayrollAction(fd)` (atomic 4-tác-vụ: Transaction EXPENSE + Payslip + EmployeeTransaction REFUND + khóa HH APPROVED→PAID).
- [x] **Step 3:** UI `/hr/employees/[id]` — nút "🧾 Thanh Toán Lương" + Modal chọn tháng/năm + gọi `getDraftPayslip` (server action async) + hiển thị Lương cứng / HH / Gross / Dư nợ + cho nhập cấn trừ + preview Thực lãnh + dropdown Quỹ + Submit `finalizePayrollAction` + bảng "Lịch sử Phiếu Lương" ở dưới.
- [x] **Step 4:** TypeScript — `tsc --noEmit` 0 lỗi (1 fix Decimal conversion). ReadLints PASS.

## Kết luận (Tầng 2 điền sau khi xong hết)
- **Hoàn thành lúc:** `09:25`
- **Ghi chú:** Đã hoàn tất 4/4 bước MSEW.

## Ghi chú kỹ thuật (tự quyết theo codebase thực tế)

1. **Decimal type của Prisma** — `EmployeeProfile.baseSalary` là `Prisma.Decimal | null`, không phải `string`. Convert sang string bằng `.toString()` ở `getDraftPayslip` (line `baseSalary = profile?.baseSalary ? profile.baseSalary.toString() : "0"`).
2. **Money utility không có `Money.min(a, b)`** — chỉ có `.lt()`, `.gt()`, `.eq()`, `.negate()`. Implement min thủ công: `currentDebt.lt(grossPay) ? currentDebt : grossPay`.
3. **MSEW Step 2.4 nói "SalesOrder.userId"** — schema thực tế dùng `salespersonId` cho hoa hồng (xem `prisma/schema.prisma`). Tôi query theo `salespersonId` (đúng pattern đã dùng ở Phase 1 + test cũ).
4. **`getDraftPayslip` không phải server action** — chỉ là function `async` đọc data, không dùng FormData. Nhưng MSEW yêu cầu đặt trong `hr-actions.ts` (file có `"use server"`). Trade-off: server action file `prisma.$transaction` không cho phép gọi từ client component — nhưng `getDraftPayslip` không có FormData → vẫn gọi được từ client với `(userId, month, year)` làm args. Next.js 15 hỗ trợ "use server" + non-form action (RSC call). Tôi giữ trong cùng file cho dễ quản lý.
5. **`finalizePayrollAction` cần `prisma.userId_month_year` unique** — Prisma tự generate compound unique input name theo convention `[field1]_[field2]_[field3]`. Verify bằng `prisma.payslip.findUnique({ where: { userId_month_year: { userId, month, year } } })`.
6. **Idempotency 2 lớp**:
   - Lớp 1 (trước tx): check `findUnique` → throw `ConflictError` nếu đã chốt.
   - Lớp 2 (trong tx): `Payslip @@unique([userId, month, year])` — bắt P2002 race condition nếu 2 request cùng lúc.
7. **Server recompute netPay** — không tin client gửi. `expectedNet = mBase + mComm - mAdv`. Nếu `!expectedNet.eq(mNet)` → throw ValidationError.
8. **`TransactionService.recordTransaction(tx, input)`** — dùng `tx` thay vì `recordTransactionInTransaction` để share transaction với các `tx.payslip.create`, `tx.salesOrder.updateMany`.
9. **`@index([userId])` Payslip** — thêm cho query "lịch sử lương theo user" (đã có `@@unique([userId, month, year])` nhưng Prisma không tự tạo FK-style index).
10. **UI Modal Pattern** — `getDraftPayslip` được gọi MỖI LẦN đổi tháng/năm → real-time recompute. State `loadingDraft` để show spinner.
11. **Cấn trừ = min(Dư nợ, Gross)** — nếu Dư nợ > Gross, mặc định cấn trừ = Gross (Thực lãnh = 0). Tránh netPay âm. Sếp có thể giảm cấn trừ để cho nợ tiếp tháng sau.
12. **`Locked commissions` count** — trả về `lockedOrders.count` để audit log biết có bao nhiêu HH bị khóa.

## Cần làm sau khi deploy
- `npx prisma db push` (thêm bảng `Payslip`).
- `npm run seed` (không cần seed gì mới).
- Truy cập `/hr/employees/{id}` → bấm "🧾 Thanh Toán Lương" → chọn tháng → xem preview → Submit.

## Rủi ro (CHƯA GIẢI QUYẾT)
- **`prisma generate` runtime binary bị Windows Defender lock** (`query_engine-windows.dll.node.tmp*`). Type definitions (`index.d.ts`) đã cập nhật → `tsc --noEmit` PASS, nhưng **runtime query Payslip ở local CÓ THỂ FAIL** do binary chưa refresh. Vercel build (`postinstall`) sẽ tự generate lại → server OK. Local fix: restart máy hoặc `rm -rf node_modules/.prisma && npx prisma generate` sau khi Defender scan xong.
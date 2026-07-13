# SKILL-USAGE cho MSEW: payroll-hr-phase2

## Step 1 (Schema)
- Assigned skills: backend-development, databases
- Invoked at: 2026-07-13 09:12
- Effectiveness: HIGH
- Notes: `Payslip` model tương đối đơn giản (12 field, 1 unique compound, 1 index). Đã thêm `@@unique([userId, month, year])` để idempotent chống chốt 2 lần cùng kỳ.

## Step 2 (Server Actions)
- Assigned skills: backend-development
- Invoked at: 2026-07-13 09:16
- Effectiveness: HIGH
- Notes:
  - **`getDraftPayslip` không nhận FormData** — chỉ là async function. Next.js 15 cho phép non-form action trong `"use server"` file → gọi được từ client component với positional args.
  - **`finalizePayrollAction` 4-tác-vụ atomic** trong 1 Prisma transaction: TransactionService.recordTransaction + tx.payslip.create + tx.employeeTransaction.create (nếu có) + tx.salesOrder.updateMany.
  - **Idempotency 2 lớp**: pre-check findUnique (ConflictError) + @@unique compound (P2002 race).
  - **Server recompute netPay** — không tin client.
  - **Money utility không có `Money.min`** — implement thủ công với `.lt()` ternary.

## Step 3 (UI)
- Assigned skills: frontend-development, ui-styling
- Invoked at: 2026-07-13 09:20
- Effectiveness: HIGH
- Notes:
  - Modal chốt lương: chọn tháng/năm → auto-call `getDraftPayslip` → render preview Gross/Net → cho sếp chỉnh cấn trừ → submit.
  - Real-time recompute netPay khi đổi cấn trừ.
  - Bảng "Lịch sử Phiếu Lương" sort theo năm/tháng desc, 24 bản ghi gần nhất.
  - Nút "🧾 Thanh Toán Lương" màu xanh (`#16A34A`) để phân biệt với Tạm ứng (cam).

## Step 4 (Audit)
- Assigned skills: audit
- Invoked at: 2026-07-13 09:25
- Effectiveness: HIGH
- Verification:
  - `tsc --noEmit`: 0 lỗi (1 fix Decimal conversion).
  - ReadLints: PASS.
  - **`prisma generate` runtime binary bị lock** — type definitions OK, runtime binary chưa refresh. Cần user restart máy hoặc `rm -rf node_modules/.prisma && npx prisma generate` sau Defender scan. Vercel postinstall sẽ work bình thường.

### Known limitations
1. **Chốt lương không có confirm 2 bước** — chỉ 1 `window.confirm()` đơn giản.
2. **Không thể sửa/xóa Payslip** sau khi chốt (đúng pattern tài chính — "đã chốt sổ là số liệu vĩnh viễn").
3. **Modal không check Dư nợ > Gross** tự động — để sếp tự chọn cấn trừ tối đa hoặc giảm.
4. **Chưa có bulk payroll** (chốt nhiều nhân viên 1 lần) — chỉ 1-1.
5. **Biến thể local binary lock** — đã ghi trong WORKFLOW-STATUS rủi ro.
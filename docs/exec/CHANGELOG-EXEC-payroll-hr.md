# CHANGELOG Thực thi (CHANGELOG-EXEC)

## MSEW: payroll-hr

| Step | File | Lines Changed | Status |
|------|------|---------------|--------|
| 1 | `prisma/schema.prisma` | +14 (`EmployeeProfile` + back-relation + 2 field SalesOrder) | DONE |
| 1 | `prisma/seed.ts` | +3 (3 quyền HR/commission) | DONE |
| 2 | `src/app/actions/hr-actions.ts` | +160 (mới, 3 server actions) | DONE |
| 3 | `src/lib/validations/order.ts` | +2 (commissionAmount vào 2 schema) | DONE |
| 3 | `src/services/sales-order.service.ts` | +2 (commissionAmount → Decimal) | DONE |
| 3 | `src/services/order-orchestrator.service.ts` | +1 (commissionAmount → createInTx SO) | DONE |
| 3 | `src/app/actions/order-actions.ts` | +6 (3 chỗ truyền commissionAmount từ FormData) | DONE |
| 3 | `src/app/(dashboard)/orders/new/UnifiedOrderForm.tsx` | +3 (state + fd.set + UI input) | DONE |
| 4 | `src/app/(dashboard)/hr/employees/page.tsx` | +30 (mới, list page) | DONE |
| 4 | `src/app/(dashboard)/hr/employees/HrEmployeesClient.tsx` | +250 (mới, list client + modal Chi) | DONE |
| 4 | `src/app/(dashboard)/hr/employees/[id]/page.tsx` | +50 (mới, detail page) | DONE |
| 4 | `src/app/(dashboard)/hr/employees/[id]/HrEmployeeDetailClient.tsx` | +300 (mới, detail client) | DONE |
| 4 | `src/components/layout/Sidebar.tsx` | +5 (nhóm Nhân sự) | DONE |
| 5 | `src/__tests__/*.integration.test.ts` | +8 (7 file, thêm commissionAmount:"0") | DONE |
| 5 | `docs/exec/WORKFLOW-STATUS-payroll-hr.md` | file mới | DONE |
| 5 | `docs/exec/CHANGELOG-EXEC-payroll-hr.md` | file mới | DONE |
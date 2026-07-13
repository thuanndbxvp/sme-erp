# CHANGELOG Thực thi (CHANGELOG-EXEC)

## MSEW: payroll-hr-phase2

| Step | File | Lines Changed | Status |
|------|------|---------------|--------|
| 1 | `prisma/schema.prisma` | +22 (`Payslip` model + `User.payslips`) | DONE |
| 2 | `src/app/actions/hr-actions.ts` | +165 (getDraftPayslip + finalizePayrollAction) | DONE |
| 3 | `src/app/(dashboard)/hr/employees/[id]/page.tsx` | +5 (query payslips) | DONE |
| 3 | `src/app/(dashboard)/hr/employees/[id]/HrEmployeeDetailClient.tsx` | refactor lớn — thêm prop payslips, nút Thanh Toán Lương, Modal Chốt Lương (month/year/draft/deduction/account), bảng Lịch sử Phiếu Lương | DONE |
| 4 | `docs/exec/WORKFLOW-STATUS-payroll-hr-phase2.md` | file mới | DONE |
| 4 | `docs/exec/CHANGELOG-EXEC-payroll-hr-phase2.md` | file mới | DONE |
| 4 | `docs/exec/SKILL-USAGE-payroll-hr-phase2.md` | file mới | DONE |
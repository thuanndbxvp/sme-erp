# PLAN: Fix ESLint errors (Unexpected any, unused variables)

## 1. Phân tích nguyên nhân
Khi chạy `npm run build`, Next.js/ESLint báo lỗi tại 4 file liên quan đến việc lạm dụng kiểu `any` và khai báo biến không sử dụng:
- `src/app/actions/debug-actions.ts`: Bắt lỗi `catch (e: any)`.
- `src/lib/action-result.ts`: Ép kiểu `(err as any)?.message`.
- `src/services/order-orchestrator.service.ts`: Dùng `(it as any).buyPrice` và `(it as any).purchaseTaxAmount`.
- `src/services/system-setting.service.ts`: Bắt lỗi `catch (err: any)` nhưng biến `err` không được dùng.

## 2. Giải pháp
- Thay thế `any` bằng `unknown` hoặc các kiểu giao diện (interface/type cast) an toàn hơn (`Error`, Record, v.v.).
- Thay thế biến bắt lỗi không dùng bằng `catch { ... }` (bỏ khai báo biến) hoặc `catch (_err)`.

## 3. Danh sách file cần sửa
- `src/app/actions/debug-actions.ts`
- `src/lib/action-result.ts`
- `src/services/order-orchestrator.service.ts`
- `src/services/system-setting.service.ts`

# MSEW: Sửa lỗi Type Error trong module AuditLog

## Bước 1: Cập nhật Interface AuditLog
- **File:** `src/components/audit/AuditTable.tsx`
- **Hành động:** Tìm và thay thế dòng định nghĩa interface `AuditLog` (khoảng dòng số 5) để cho phép `userId` có thể là `null`.

**Tìm chính xác:**
```typescript
interface AuditLog { id: string; action: string; entityType: string; entityId: string; userId: string; createdAt: Date; }
```

**Thay thế bằng:**
```typescript
interface AuditLog { id: string; action: string; entityType: string; entityId: string; userId: string | null; createdAt: Date; }
```

*Lưu ý cho Coder: Sau khi sửa, chạy lại `npm run build` để đảm bảo lỗi đã được giải quyết.*

# MSEW: Thực thi Quản lý User (Xóa an toàn, Popup)
**Dành cho**: Tầng 2 (Autonomous Engineer)

## Bước 1: Cập nhật Seed
1. Mở `prisma/seed.ts`, tìm list `PERMISSION_CODES` và bổ sung `"users.delete"`. Thêm mô tả tương ứng.
2. Chạy lệnh: `npx prisma db push` (do đây là dev db) hoặc `npx prisma generate` (nếu chỉ cập nhật type) hoặc tùy luồng database seeding để apply quyền mới.

## Bước 2: Cập nhật Server Actions
1. Mở `src/app/actions/admin-actions.ts`.
2. Tạo hàm mới: `export async function deleteUser(fd: FormData)`
   - Cần Auth và kiểm tra DB xem có role chứa quyền `users.delete` hay không (giống các action khác).
   - Lấy `id` từ `FormData`. 
   - Truy vấn xem User có nằm trong `SalesOrder`, `PurchaseOrder` hoặc `Transaction` nào không. 
   - Nếu có -> return `{ok: false, error: "Người dùng đã có giao dịch, chỉ có thể KHÓA chứ không thể XÓA."}`.
   - Nếu sạch sẽ: `prisma.user.delete({ where: { id } })`.
   - Lập Audit Log: `[XÓA NGƯỜI DÙNG] id`.

## Bước 3: Đập đi xây lại Form thành Popup trong `UsersClient.tsx`
1. Mở `src/app/(dashboard)/users/UsersClient.tsx`.
2. Thay vì render cái div form bên trên bảng `{!showForm ? ... : <div>...</div>}`, hãy render nó dưới dạng một Fixed Modal ở cuối component:
   ```tsx
   {showForm && (
     <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
       <div style={{ background: 'white', padding: 24, borderRadius: 8, width: 400 }}>
         {/* Bê form Thêm/Sửa vào đây */}
       </div>
     </div>
   )}
   ```
3. Cột Thao Tác (Bảng UI):
   - Thêm nút **Xóa** (gọi `deleteUser`). Nút này dùng màu đỏ gắt hơn màu cam của nút Khóa, hoặc gọi hàm window.confirm hỏi "Chắc chắn Xóa?".

## Bước 4: Kiểm tra Linter
Chạy `npm run typecheck` để đảm bảo code sạch sẽ.

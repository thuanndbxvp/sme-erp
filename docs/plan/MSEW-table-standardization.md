# MSEW: Thêm STT và Phân trang (Pagination) cho tất cả Table

Tầng 2 (Coder) hãy lặp qua các file được liệt kê và áp dụng chuẩn sau:

## 1. Chuẩn mực (Standard)
1. **Cột STT:**
   - Tại `<thead>`: Thêm `<th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center", width: 50 }}>STT</th>` vào vị trí đầu tiên.
   - Tại `<tbody>`: Thêm `<td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}>{(currentPage - 1) * pageSize + index + 1}</td>` vào đầu.
2. **Phân trang (Pagination):**
   - Đặt hằng số `pageSize = 20` (hoặc giữ nguyên nếu đã có limit khác).
   - Component `<Pagination currentPage={currentPage} totalPages={totalPages} />` (từ `src/components/ui/Pagination.tsx`) được gắn bên dưới `</table>`.
   - Nếu dữ liệu chỉ load 1 lần trên client (vd list array), sử dụng `.slice((currentPage - 1) * pageSize, currentPage * pageSize)` để chia mảng.

## 2. Các file cần xử lý Client-side Pagination (Dùng state `currentPage`)
Đối với các Server Component nhưng truyền toàn bộ Array dữ liệu xuống Client Component:
- `src/app/(dashboard)/users/UsersClient.tsx`
- `src/app/(dashboard)/roles/RolesClient.tsx`
- `src/app/(dashboard)/cashflow/CashflowClient.tsx` (Bảng giao dịch sổ quỹ)

*Hướng dẫn xử lý Client-side:*
Thêm state: `const [currentPage, setCurrentPage] = useState(1);`
Lấy số trang: `const totalPages = Math.ceil(dataArray.length / pageSize);`
Cắt mảng: `const displayData = dataArray.slice((currentPage - 1) * pageSize, currentPage * pageSize);`
Gắn UI: tự tạo bộ nút `< 1 2 3 >` đơn giản hoặc dùng component `Pagination` (Lưu ý: `Pagination.tsx` hiện tại dùng query URL, nên ở các Client Component không dính đến URL, bạn có thể tự viết 1 dải nút "Trước/Sau" đơn giản như trong `OrderTabsClient`).

## 3. Các file cần xử lý URL-based Pagination (Dùng `searchParams`)
Đối với các trang là Server Component (`page.tsx`) hoặc lấy `page` từ URL:
- `src/app/(dashboard)/debts/page.tsx` (truyền page vào `AgingView`)
- `src/components/debts/AgingView.tsx` (Thêm cột STT, cắt mảng theo `searchParams` hoặc state)
- `src/app/(dashboard)/catalog/product/page.tsx`
- `src/app/(dashboard)/customers/[id]/page.tsx` (Bảng lịch sử đơn hàng/hoá đơn)
- `src/app/(dashboard)/suppliers/[id]/page.tsx` (Bảng lịch sử đơn hàng/hoá đơn)
- `src/app/(dashboard)/products/[id]/page.tsx` (Bảng lịch sử)
- `src/app/(dashboard)/reports/page.tsx`

*Hướng dẫn xử lý Server-side:*
```typescript
const page = parseInt(searchParams.page || "1", 10);
const pageSize = 20;
// Slice data hoặc DB query.
// Import Pagination: import { Pagination } from "@/components/ui/Pagination";
```

## 4. Các file chỉ cần thêm STT (đã có sẵn cơ chế hoặc không cần phân trang)
- `src/app/(dashboard)/orders/OrderTabsClient.tsx` (Trang này ĐÃ có phân trang URL-based, chỉ cần sửa thead/tbody thêm cột STT).
- `src/app/(dashboard)/orders/new/UnifiedOrderForm.tsx` (Bảng chọn sản phẩm: Không cần phân trang, CHỈ THÊM STT = `index + 1`).
- `src/app/(dashboard)/audit/page.tsx` (Thêm STT, nếu list quá dài có thể gắn thêm `slice` & query page).

**Nhiệm vụ của Coder:** Rà soát từng file một, sửa cẩn thận, chạy `npm run lint` sau khi làm xong để tránh rớt type. Không xoá logic hiện tại, chỉ lồng thêm thuật toán phân trang và chèn cột `<td STT>`.

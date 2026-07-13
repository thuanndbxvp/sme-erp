# MSEW: Thực thi Redesign Dashboard & P&L
**Dành cho**: Tầng 2 (Autonomous Engineer)

## Bước 1: Cài đặt thư viện
1. Mở terminal và chạy lệnh:
   ```bash
   bun add recharts lucide-react
   ```

## Bước 2: Viết logic lấy dữ liệu P&L (Server)
1. Mở (hoặc tạo) file xử lý logic cho Dashboard (ví dụ: `src/app/(dashboard)/page.tsx` hoặc 1 action riêng).
2. Viết logic tính toán Doanh thu và Chi phí (lấy từ bảng `Transaction` type `INCOME` và `EXPENSE`).
   - Mặc định trả về dữ liệu 6 tháng gần nhất để làm biểu đồ:
   - Group by Tháng. Ví dụ: `[{ name: "Tháng 1", revenue: 15000000, expense: 8000000 }, ...]`

## Bước 3: Đập đi xây lại `DashboardClient.tsx`
1. Mở `src/app/(dashboard)/DashboardClient.tsx` (hoặc component tương ứng hiển thị UI hiện tại).
2. Import `BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer` từ `recharts`.
3. Import các icon từ `lucide-react` (ví dụ: `Wallet, TrendingUp, TrendingDown, AlertCircle`).
4. **CSS Tái cấu trúc**:
   - Thay các `style={{}}` inline chật chội bằng các class CSS sạch sẽ (hoặc biến CSS), đảm bảo gap, padding rộng rãi.
   - 4 Card KPI ở trên cùng: Thêm Icon, số liệu to rõ, màu sắc phân biệt (Xanh cho Thu/Tiền, Đỏ cho Trả).
   - Chèn thẻ `<ResponsiveContainer width="100%" height={300}>` chứa Biểu đồ BarChart ở ngay dưới phần KPI.
   - Bọc 3 cột (Top AR, AP, Tồn kho) bằng CSS Grid: `display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px;`.
   - Mỗi cột là một thẻ Card màu trắng, có shadow mỏng, border-radius 12px.

## Bước 4: Kiểm tra Linter & Chạy thử
- Chạy `npm run typecheck` và `npm run lint` để đảm bảo code React không bị lỗi.
- Check giao diện để đảm bảo tính responsive và tính thẩm mỹ cao (đúng chuẩn "Premium").

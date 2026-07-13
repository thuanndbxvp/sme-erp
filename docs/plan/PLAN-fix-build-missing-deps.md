# Kiến trúc và Kế hoạch: Sửa lỗi Build Vercel (Thiếu Dependencies)

## 1. Tóm tắt vấn đề
- Khi Vercel chạy lệnh `npm run build`, Next.js báo lỗi không tìm thấy 2 module là `lucide-react` và `recharts` trong file `src/app/(dashboard)/DashboardClient.tsx`.
- Nguyên nhân: Các thư viện này đang được import trong code nhưng chưa được khai báo trong `package.json` (phần `dependencies`). Do lúc code ở local có thể đã chạy hoặc copy code vào chưa kịp install, dẫn đến khi Vercel build môi trường mới (CI/CD) sẽ thiếu thư viện.

## 2. Giải pháp
- Cần cài đặt bổ sung 2 packages:
  - `lucide-react`: Chứa các icon SVG.
  - `recharts`: Thư viện vẽ biểu đồ (chart).
- Lưu lại vào `package.json` để Vercel có thể tải về khi thực hiện `npm install`.

## 3. Danh sách file bị ảnh hưởng
- `package.json` (sẽ được tự động cập nhật khi chạy lệnh install)
- `package-lock.json` (sẽ được tự động cập nhật)

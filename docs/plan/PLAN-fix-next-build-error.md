# PLAN: Sửa lỗi Build Next.js (Cannot find module)

## 1. Phân tích nguyên nhân
Khi chạy `npm run build`, Next.js quăng lỗi sập build:
```
[Error: Cannot find module 'next/dist/pages/_app']
```
Đây là lỗi thường gặp ở Next.js do một trong hai nguyên nhân:
1. Thư mục cache build `.next` bị hỏng hoặc xung đột dữ liệu cũ.
2. Thư mục `node_modules` (cụ thể là module `next`) bị thiếu file hoặc lỗi trong quá trình phân giải package.

## 2. Giải pháp
Vì lỗi này nằm ở tầng môi trường (environment) thay vì source code, chúng ta cần:
- Xóa sạch tàn dư của các bản build lỗi (thư mục `.next`).
- Dọn dẹp lại `node_modules` để đảm bảo package manager kéo về đúng và đủ các dependencies.
- Cài đặt và build lại từ đầu.

## 3. Danh sách file cần tác động
- Xóa thư mục `.next`
- Xóa thư mục `node_modules`
- Xóa `package-lock.json` (nếu cần thiết để resync)

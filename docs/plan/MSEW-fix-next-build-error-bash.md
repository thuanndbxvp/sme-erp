# MSEW: Sửa lỗi Build Next.js (Môi trường Git Bash)

## Lệnh thực thi trên Terminal (Git Bash / MINGW64)

### Bước 1: Dọn dẹp siêu tốc bằng lệnh native bash
```bash
rm -rf .next .turbo node_modules package-lock.json
```

### Bước 2: Cài đặt lại các package
```bash
npm install
```

### Bước 3: Build lại dự án
```bash
npm run build
```

*Lưu ý cho Coder: Chạy chính xác các lệnh bash này trên terminal của sếp, không dùng lệnh PowerShell nữa.*

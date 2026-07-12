# MSEW: Sửa lỗi Build Next.js (Cannot find module)

## Lệnh thực thi trên Terminal
Do đây là lỗi môi trường, Tầng 2 chỉ cần chạy các lệnh sau (có thể gộp chung hoặc chạy tuần tự trong PowerShell):

### Bước 1: Dọn dẹp cache và dependency cũ
```powershell
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
```

### Bước 2: Cài đặt lại các package
```powershell
npm install
```

### Bước 3: Build lại dự án
```powershell
npm run build
```

*Lưu ý cho Coder: Thực thi thẳng các lệnh trên trong Terminal của dự án SME-ERP. Nếu `npm install` vẫn lỗi thì xóa thêm `package-lock.json` trước khi install.*

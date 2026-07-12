# MSEW: Micro-Step Execution Workflow (Khởi động lại Dev Server)

> **Gửi Tầng 2 (Coder):** Thao tác nhanh 3 lệnh sau trong Terminal để refresh lại CSS pipeline cho Next.js.

## Bước 1: Dọn dẹp và Restart
Mở một tab Terminal (PowerShell) mới và dán chính xác dòng lệnh sau:

```powershell
# 1. Ép tắt tất cả các tiến trình Node.js đang chạy ngầm (bao gồm cái Dev Server cũ)
Stop-Process -Name node -Force -ErrorAction SilentlyContinue

# 2. Xóa sạch thư mục cache biên dịch bị lỗi
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue

# 3. Khởi động lại Server với cấu hình Tailwind v4 mới tinh
npm run dev
```

Sau khi Terminal báo xanh `✓ Ready`, hãy báo sếp F5 lại trình duyệt. Giao diện sẽ được khoác áo CSS đầy đủ, Sidebar sẽ tách ra một bên và các thẻ Card sẽ có màu sắc chuẩn FinTech!

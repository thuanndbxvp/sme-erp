# MSEW: Micro-Step Execution Workflow (Fix Build Errors)

> **Gửi Tầng 2 (Coder):** Làm theo đúng thứ tự 2 bước dưới đây để dọn dẹp triệt để lỗi của Next.js.

## Bước 1: Sửa lỗi TypeScript cho NextAuth
Mở file `src/types/next-auth.d.ts`. Cập nhật nội dung thành đoạn code sau để bơm thêm thuộc tính `role`:

```typescript
import type { DefaultSession, DefaultUser } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role?: string;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    role?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    role?: string;
  }
}
```

## Bước 2: Dọn dẹp Cache và Khởi động lại Server
Mở một tab Terminal mới (hoặc tắt tiến trình `npm run dev` hiện tại bằng cách ấn `Ctrl + C`), sau đó dán lần lượt 3 lệnh sau (dành cho PowerShell trên Windows):

```powershell
# 1. Tắt tất cả tiến trình node (để dọn Prisma Worker đang treo)
Stop-Process -Name node -ErrorAction SilentlyContinue

# 2. Xóa thư mục cache Next.js bị lỗi ENOENT
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue

# 3. Build lại Type và bật lại Dev Server
npm run dev
```

*(Ghi chú: Lỗi Postgres Connection Reset ở môi trường Dev là bình thường do Neon tự ngắt kết nối khi idle hoặc server Next.js sập đột ngột. Khi chạy lại `npm run dev`, Prisma Pool sẽ tự động mở kết nối mới chạy ngon lành).*

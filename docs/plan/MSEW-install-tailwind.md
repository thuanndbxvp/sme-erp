# MSEW: Micro-Step Execution Workflow (Cài đặt Tailwind CSS)

> **Gửi Tầng 2 (Coder):** Thao tác cẩn thận, không xóa mất code CSS cũ trong file globals.css.

## Bước 1: Cài đặt Packages
Tắt Dev Server (nếu đang chạy). Mở Terminal và dán lệnh sau để cài đặt bộ khung Tailwind:

```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p --ts
```
*(Lệnh này sẽ tự động sinh ra 2 file `tailwind.config.ts` và `postcss.config.js` ở thư mục gốc `D:\sme-erp\`)*

## Bước 2: Cấu hình quét file (Tailwind Config)
Mở file `tailwind.config.ts` vừa được tạo ra. Thay thế nội dung bên trong thành cấu hình quét chuẩn của Next.js App Router:

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
export default config;
```

## Bước 3: Kích hoạt Tailwind trong Global CSS
Mở file `src/app/globals.css`. 
Chèn chính xác 3 dòng mã này vào **NGAY DÒNG ĐẦU TIÊN** (Trên cùng của file):

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Giữ nguyên toàn bộ phần CSS cũ của sếp ở bên dưới... */
/* SME ERP Design System — Exaggerated Minimalism + Swiss Style */
/* ... */
```

## Bước 4: Chạy lại hệ thống
Chạy lệnh `npm run dev`. Lúc này hệ thống sẽ tự động quét các class như `p-6`, `grid-cols-4`, `bg-white` và khoác áo giao diện đẹp đẽ lên Dashboard!

# MSEW: Micro-Step Execution Workflow (Ẩn Sidebar trang Login)

> **Gửi Tầng 2 (Coder):** Hãy thực hiện chính xác các thao tác sau, không tự ý sửa đổi ngoài phạm vi.

## Bước 1: Tạo file Client Component `AppLayout`
Tạo file mới tại đường dẫn `src/components/layout/AppLayout.tsx` với nội dung:

```tsx
"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { ReactNode } from "react";

export function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  // Nếu là trang đăng nhập, chỉ hiển thị content căn giữa, ẩn sidebar
  if (isLoginPage) {
    return (
      <main style={{ minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center", backgroundColor: "var(--bg-subtle)" }}>
        {children}
      </main>
    );
  }

  // Giao diện dashboard chuẩn có Sidebar
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />
      <main style={{ flex: 1, marginLeft: "var(--sidebar-width)", padding: "var(--space-6)" }}>
        {children}
      </main>
    </div>
  );
}
```

## Bước 2: Cập nhật lại RootLayout
Mở file `src/app/layout.tsx` và thay thế toàn bộ bằng đoạn code sau để sử dụng `AppLayout` vừa tạo:

```tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import "./globals.css";

export const metadata: Metadata = {
  title: "SME ERP",
  description: "ERP thương mại cho doanh nghiệp SME",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <AppLayout>
          {children}
        </AppLayout>
      </body>
    </html>
  );
}
```

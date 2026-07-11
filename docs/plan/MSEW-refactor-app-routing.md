# MSEW: Micro-Step Execution Workflow (Refactor App Routing)

> **Gửi Tầng 2 (Coder):** Thao tác di chuyển hàng loạt thư mục rất dễ nhầm lẫn. Hãy làm cẩn thận theo từng bước hoặc dùng Bash Script để an toàn tuyệt đối.

## Bước 1: Tạo thư mục và di chuyển Modules
Mở Terminal, chạy lần lượt các lệnh sau (nếu dùng Windows PowerShell):

```powershell
# 1. Tạo thư mục Route Group
New-Item -ItemType Directory -Force -Path "src/app/(dashboard)"

# 2. Định nghĩa danh sách các thư mục cần dời (KHÔNG dời api, login, globals.css, layout.tsx)
$folders = @("cashflow", "catalog", "customers", "debts", "orders", "products", "profile", "reports", "roles", "suppliers", "users", "audit")

# 3. Di chuyển các thư mục
foreach ($folder in $folders) {
    if (Test-Path "src/app/$folder") {
        Move-Item -Path "src/app/$folder" -Destination "src/app/(dashboard)/"
    }
}

# 4. Di chuyển trang chủ (page.tsx)
if (Test-Path "src/app/page.tsx") {
    Move-Item -Path "src/app/page.tsx" -Destination "src/app/(dashboard)/page.tsx"
}
```

*(Nếu dùng Linux/Mac bash: `mkdir -p src/app/\(dashboard\) && mv src/app/{cashflow,catalog,customers,debts,orders,products,profile,reports,roles,suppliers,users,audit,page.tsx} src/app/\(dashboard\)/ 2>/dev/null`)*

## Bước 2: Xây dựng `(dashboard)/layout.tsx`
Tạo file `src/app/(dashboard)/layout.tsx` với nội dung sau:

```tsx
import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/Sidebar";

export default function DashboardLayout({ children }: { children: ReactNode }) {
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

## Bước 3: Dọn dẹp RootLayout (`src/app/layout.tsx`)
Thay thế toàn bộ nội dung file `src/app/layout.tsx` để xóa `<Sidebar />` và trả nó về dạng khung HTML cơ bản:

```tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "SME ERP",
  description: "ERP thương mại cho doanh nghiệp SME",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body>
        {children}
      </body>
    </html>
  );
}
```

*(Ghi chú: Nếu trước đó bạn đã tạo `AppLayout.tsx` như ở bản vá tạm thời, hãy xóa file `src/components/layout/AppLayout.tsx` đi vì chúng ta không cần nó nữa).*

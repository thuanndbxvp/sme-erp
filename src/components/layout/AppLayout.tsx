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

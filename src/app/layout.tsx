import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import "./globals.css";

export const metadata: Metadata = {
  title: "SME ERP",
  description: "ERP thương mại cho doanh nghiệp SME",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <div style={{ display: "flex", minHeight: "100vh" }}>
          <Sidebar />
          <main style={{ flex: 1, marginLeft: "var(--sidebar-width)", padding: "var(--space-6)" }}>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}

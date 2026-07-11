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

"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard Error:", error);
  }, [error]);

  return (
    <div style={{ padding: "var(--space-6)", textAlign: "center", marginTop: "var(--space-12)" }}>
      <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 600, color: "var(--color-danger-500)", marginBottom: "var(--space-4)" }}>
        Đã có lỗi xảy ra!
      </h2>
      <p style={{ color: "var(--color-foreground-muted)", marginBottom: "var(--space-6)" }}>
        {error.message || "Lỗi máy chủ nội bộ. Vui lòng thử lại sau."}
        <br />
        <span style={{ fontSize: "var(--text-sm)", opacity: 0.7 }}>
          Digest: {error.digest || "N/A"}
        </span>
      </p>
      
      <div style={{ display: "flex", gap: "var(--space-4)", justifyContent: "center" }}>
        <button
          onClick={() => reset()}
          style={{
            padding: "var(--space-2) var(--space-4)",
            backgroundColor: "var(--color-primary-500)",
            color: "white",
            borderRadius: "var(--radius-md)",
            border: "none",
            cursor: "pointer"
          }}
        >
          Thử lại
        </button>
        <Link 
          href="/"
          style={{
            padding: "var(--space-2) var(--space-4)",
            backgroundColor: "var(--color-surface-hover)",
            color: "var(--color-foreground)",
            borderRadius: "var(--radius-md)",
            textDecoration: "none"
          }}
        >
          Về trang chủ
        </Link>
      </div>
    </div>
  );
}

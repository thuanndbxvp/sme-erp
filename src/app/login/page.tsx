"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setError(null);
    setPending(true);
    const result = await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirect: false,
    });
    setPending(false);
    if (result?.error) {
      setError("Email hoặc mật khẩu không đúng");
    } else {
      const cb = params.get("callbackUrl") ?? "/";
      router.push(cb);
      router.refresh();
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--color-bg)",
      }}
    >
      <div
        style={{
          width: 400,
          background: "var(--color-surface)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--color-border)",
          boxShadow: "var(--shadow-lg)",
          padding: "var(--space-8)",
        }}
      >
        {/* Brand */}
        <div style={{ textAlign: "center", marginBottom: "var(--space-8)" }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "var(--radius-lg)",
              background: "var(--color-primary)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontWeight: 700,
              fontSize: "var(--text-xl)",
              marginBottom: "var(--space-4)",
            }}
          >
            E
          </div>
          <h1 style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: "var(--color-foreground)", margin: 0 }}>
            Đăng nhập SME ERP
          </h1>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-foreground-muted)", marginTop: "var(--space-2)" }}>
            Hệ thống quản lý thương mại
          </p>
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              padding: "var(--space-3) var(--space-4)",
              background: "var(--color-destructive-bg)",
              color: "var(--color-destructive)",
              borderRadius: "var(--radius-md)",
              fontSize: "var(--text-sm)",
              marginBottom: "var(--space-4)",
              border: "1px solid var(--color-destructive)",
            }}
            role="alert"
          >
            {error}
          </div>
        )}

        {/* Form */}
        <form action={onSubmit} style={{ display: "grid", gap: "var(--space-5)" }}>
          <div>
            <label
              htmlFor="email"
              style={{
                display: "block",
                fontSize: "var(--text-sm)",
                fontWeight: 600,
                marginBottom: "var(--space-1)",
              }}
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              defaultValue="admin@sme-erp.local"
              required
              style={{
                width: "100%",
                height: "var(--touch-target)",
                padding: "0 var(--space-3)",
                border: "1px solid var(--color-border-strong)",
                borderRadius: "var(--radius-md)",
                fontSize: "var(--text-base)",
                fontFamily: "var(--font-sans)",
                outline: "none",
              }}
            />
          </div>
          <div>
            <label
              htmlFor="password"
              style={{
                display: "block",
                fontSize: "var(--text-sm)",
                fontWeight: 600,
                marginBottom: "var(--space-1)",
              }}
            >
              Mật khẩu
            </label>
            <input
              id="password"
              name="password"
              type="password"
              defaultValue="admin12345"
              required
              style={{
                width: "100%",
                height: "var(--touch-target)",
                padding: "0 var(--space-3)",
                border: "1px solid var(--color-border-strong)",
                borderRadius: "var(--radius-md)",
                fontSize: "var(--text-base)",
                fontFamily: "var(--font-sans)",
                outline: "none",
              }}
            />
          </div>
          <Button type="submit" variant="primary" disabled={pending} style={{ width: "100%", justifyContent: "center" }}>
            {pending ? "Đang đăng nhập..." : "Đăng nhập"}
          </Button>
        </form>

        <p style={{ textAlign: "center", marginTop: "var(--space-6)", fontSize: "var(--text-xs)", color: "var(--color-foreground-subtle)" }}>
          SME ERP v0.1 — Dùng cho nội bộ doanh nghiệp
        </p>
      </div>
    </div>
  );
}

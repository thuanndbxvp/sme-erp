"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCatalogItem } from "@/app/actions/catalog";

interface Props {
  product: { id: string; name: string; unit: string; sellPrice: unknown; buyPrice: unknown };
}

export default function QuickEditProductForm({ product }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [show, setShow] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await updateCatalogItem("product", product.id, fd);
      if (r.ok) {
        setMsg("Đã lưu thành công!");
        setTimeout(() => setShow(false), 1000);
        router.refresh();
      } else {
        setMsg(r.error);
      }
    });
  }

  const S: React.CSSProperties = { width: "100%", height: 36, padding: "0 8px", border: "1px solid var(--color-border-strong)", borderRadius: "var(--radius-sm)", fontSize: "var(--text-sm)", fontFamily: "var(--font-sans)", background: "var(--color-surface)" };

  return (
    <div style={{ position: "relative" }}>
      <button type="button" onClick={() => setShow(!show)} style={{ height: 32, padding: "0 12px", borderRadius: "var(--radius-md)", fontSize: "var(--text-xs)", fontWeight: 600, cursor: "pointer", border: "1px solid var(--color-border-strong)", background: show ? "var(--color-border-strong)" : "var(--color-surface)", color: show ? "var(--color-surface)" : "var(--color-foreground-muted)", display: "flex", alignItems: "center", gap: 6, transition: "all 0.2s" }}>
        ✏ Sửa
      </button>

      {show && (
        <div style={{ position: "absolute", top: "100%", right: 0, zIndex: 50, marginTop: "var(--space-2)", background: "var(--color-surface)", border: "1px solid var(--color-border-strong)", borderRadius: "var(--radius-lg)", padding: "var(--space-4)", width: 360, boxShadow: "var(--shadow-lg)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
             <h3 style={{ fontSize: "var(--text-base)", fontWeight: 700, margin: 0 }}>Sửa nhanh sản phẩm</h3>
             <button type="button" onClick={() => setShow(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "16px", color: "var(--color-foreground-muted)" }}>✕</button>
          </div>
          {msg && <div style={{ padding: "var(--space-2)", background: msg.includes("Đã") ? "var(--color-success-bg)" : "var(--color-destructive-bg)", color: msg.includes("Đã") ? "var(--color-success)" : "var(--color-destructive)", borderRadius: "var(--radius-sm)", fontSize: "var(--text-xs)", marginBottom: "var(--space-3)" }}>{msg}</div>}
          <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-foreground-muted)" }}>Tên sản phẩm</label>
              <input name="name" defaultValue={product.name} style={S} required />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-foreground-muted)" }}>Đơn vị tính</label>
              <input name="unit" defaultValue={product.unit} style={S} required />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-foreground-muted)" }}>Giá nhập</label>
                <input type="number" step="0.01" name="buyPrice" defaultValue={Number(product.buyPrice)} style={S} required />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-foreground-muted)" }}>Giá bán</label>
                <input type="number" step="0.01" name="sellPrice" defaultValue={Number(product.sellPrice)} style={S} required />
              </div>
            </div>
            <button type="submit" disabled={pending} style={{ height: 38, width: "100%", marginTop: "var(--space-1)", borderRadius: "var(--radius-sm)", fontSize: "var(--text-sm)", fontWeight: 700, cursor: "pointer", border: "none", background: "var(--color-primary)", color: "white" }}>{pending ? "..." : "Lưu thay đổi"}</button>
          </form>
        </div>
      )}
    </div>
  );
}

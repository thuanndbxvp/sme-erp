"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTransactionCategory } from "@/app/actions/admin-actions";

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function CategoriesClient({ categories }: { categories: any[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [parentId, setParentId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const roots = categories.filter((c: any) => !c.parentId);
  const children = (pid: string) => categories.filter((c: any) => c.parentId === pid);

  function onSubmit(fd: FormData) {
    setError(null);
    startTransition(async () => {
      const r = await createTransactionCategory(fd);
      if (r.ok) { setShowForm(false); router.refresh(); }
      else setError(r.error);
    });
  }

  const S: React.CSSProperties = { width: "100%", height: 40, padding: "0 10px", border: "1px solid var(--color-border-strong)", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", fontFamily: "var(--font-sans)" };

  return (
    <div>
      <button onClick={() => setShowForm(!showForm)} style={{ height: 40, padding: "0 16px", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", fontWeight: 600, cursor: "pointer", border: "none", background: "var(--color-primary)", color: "white", marginBottom: "var(--space-5)" }}>+ Thêm danh mục con</button>

      {showForm && (
        <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "var(--space-5)", marginBottom: "var(--space-5)", maxWidth: 480 }}>
          {error && <div style={{ padding: "var(--space-2)", background: "var(--color-destructive-bg)", color: "var(--color-destructive)", borderRadius: "var(--radius-sm)", fontSize: "var(--text-xs)", marginBottom: "var(--space-3)" }}>{error}</div>}
          <form action={onSubmit} style={{ display: "grid", gap: "var(--space-3)" }}>
            <div>
              <label style={{ fontSize: "var(--text-xs)", fontWeight: 600, display: "block", marginBottom: 2 }}>Thuộc danh mục cha</label>
              <select value={parentId} onChange={e => setParentId(e.target.value)} style={S}>
                <option value="">-- Chọn danh mục cha --</option>
                {roots.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <input type="hidden" name="parentId" value={parentId} />
            </div>
            <input name="name" placeholder="Tên danh mục con" style={S} required />
            <input type="hidden" name="type" value="ALL" />
            <div style={{ display: "flex", gap: "var(--space-3)" }}>
              <button type="submit" disabled={pending} style={{ height: 40, padding: "0 16px", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", fontWeight: 600, cursor: "pointer", border: "none", background: "var(--color-primary)", color: "white" }}>{pending ? "..." : "Tạo"}</button>
              <button type="button" onClick={() => setShowForm(false)} style={{ height: 40, padding: "0 16px", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", fontWeight: 600, cursor: "pointer", border: "1px solid var(--color-border-strong)", background: "var(--color-surface)", color: "var(--color-foreground)" }}>Hủy</button>
            </div>
          </form>
        </div>
      )}

      {/* Tree */}
      {roots.map((root: any) => (
        <div key={root.id} style={{ marginBottom: "var(--space-6)" }}>
          <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--color-primary)", marginBottom: "var(--space-3)", padding: "var(--space-3)", background: "var(--color-primary)10", borderRadius: "var(--radius-md)" }}>
            📁 {root.name}
            <span style={{ fontSize: "var(--text-xs)", color: "var(--color-foreground-muted)", fontWeight: 400, marginLeft: "var(--space-2)" }}>
              ({children(root.id).length} danh mục con)
            </span>
          </h2>
          {children(root.id).length === 0 ? (
            <div style={{ fontSize: "var(--text-sm)", color: "var(--color-foreground-muted)", padding: "var(--space-2) var(--space-4)" }}>
              Chưa có danh mục con. Nhấn &quot;Thêm danh mục con&quot; để tạo.
            </div>
          ) : (
            <div style={{ display: "grid", gap: "var(--space-2)", marginLeft: "var(--space-4)" }}>
              {children(root.id).map((child: any) => (
                <div key={child.id} style={{ padding: "var(--space-2) var(--space-4)", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>📄 {child.name}</span>
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--color-foreground-muted)" }}>{child.isActive ? "Active" : "Inactive"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

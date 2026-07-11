"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createWarehouseOrder, createDropshipOrder } from "@/app/actions/order-actions";

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function OrderFormClient({ customers, suppliers, warehouses, products }: { customers: any[]; suppliers: any[]; warehouses: any[]; products: any[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"WAREHOUSE" | "DROPSHIP">("WAREHOUSE");
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "");
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [items, setItems] = useState([{ productName: "", qty: 1, sellPrice: "0", baseCost: "0", buyPrice: "0" }]);

  function addItem() { setItems([...items, { productName: "", qty: 1, sellPrice: "0", baseCost: "0", buyPrice: "0" }]); }
  function removeItem(i: number) { if (items.length > 1) setItems(items.filter((_, idx) => idx !== i)); }
  function updateItem(i: number, f: string, v: any) {
    setItems(items.map((it, idx) => idx === i ? { ...it, [f]: v } : it));
  }

  function onSubmit() {
    setError(null);
    const formData = new FormData();
    formData.set("customerId", customerId);
    formData.set("warehouseId", warehouseId);
    formData.set("supplierId", supplierId);
    formData.set("items", JSON.stringify(items.map(it => ({ ...it, qty: Number(it.qty), buyPrice: String(it.buyPrice), sellPrice: String(it.sellPrice), baseCost: String(it.baseCost), taxAmount: "0", unit: "cái", productId: products.find(p => p.name === it.productName)?.id }))));
    const action = mode === "WAREHOUSE" ? createWarehouseOrder : createDropshipOrder;
    startTransition(async () => {
      const r = await action(formData);
      if (r.ok) { router.push("/orders"); router.refresh(); }
      else setError(r.error);
    });
  }

  const inputStyle: React.CSSProperties = { width: "100%", height: 40, padding: "0 10px", border: "1px solid var(--color-border-strong)", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", fontFamily: "var(--font-sans)", background: "var(--color-surface)" };
  const btnBase: React.CSSProperties = { height: 40, padding: "0 20px", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", fontWeight: 600, cursor: "pointer", border: "1px solid var(--color-border-strong)" };

  return (
    <div style={{ maxWidth: 700 }}>
      {error && <div style={{ padding: "var(--space-3) var(--space-4)", background: "var(--color-destructive-bg)", color: "var(--color-destructive)", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", marginBottom: "var(--space-4)" }}>{error}</div>}

      {/* Mode toggle */}
      <div style={{ display: "flex", gap: 0, marginBottom: "var(--space-5)" }}>
        {(["WAREHOUSE", "DROPSHIP"] as const).map(m => (
          <button key={m} onClick={() => setMode(m)} style={{ ...btnBase, background: mode === m ? "var(--color-primary)" : "var(--color-surface)", color: mode === m ? "white" : "var(--color-foreground)", borderColor: mode === m ? "var(--color-primary)" : "var(--color-border-strong)" }}>
            {m === "WAREHOUSE" ? "Bán từ kho" : "Dropship"}
          </button>
        ))}
      </div>

      {/* Basic fields */}
      <div style={{ display: "grid", gap: "var(--space-4)", marginBottom: "var(--space-5)" }}>
        <SelectField label="Khách hàng" value={customerId} onChange={setCustomerId} options={customers.map(c => ({ value: c.id, label: c.name }))} style={inputStyle} />
        {mode === "DROPSHIP" && <SelectField label="Nhà cung cấp" value={supplierId} onChange={setSupplierId} options={suppliers.map(s => ({ value: s.id, label: s.name }))} style={inputStyle} />}
        <SelectField label="Kho" value={warehouseId} onChange={setWarehouseId} options={warehouses.map(w => ({ value: w.id, label: w.name }))} style={inputStyle} />
      </div>

      {/* Items */}
      <div style={{ marginBottom: "var(--space-5)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-3)" }}>
          <h3 style={{ fontSize: "var(--text-base)", fontWeight: 600 }}>Sản phẩm ({items.length})</h3>
          <button onClick={addItem} style={{ ...btnBase, background: "var(--color-surface)" }}>+ Thêm dòng</button>
        </div>
        {items.map((it, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto", gap: "var(--space-2)", marginBottom: "var(--space-2)", alignItems: "end" }}>
            <div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--color-foreground-muted)", marginBottom: 2 }}>Sản phẩm</div>
              <input value={it.productName} onChange={e => updateItem(i, "productName", e.target.value)} placeholder="Tên SP" list="products" style={inputStyle} />
              <datalist id="products">{products.map(p => <option key={p.id} value={p.name} />)}</datalist>
            </div>
            <div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--color-foreground-muted)", marginBottom: 2 }}>SL</div>
              <input type="number" value={it.qty} onChange={e => updateItem(i, "qty", Number(e.target.value))} min={1} style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--color-foreground-muted)", marginBottom: 2 }}>Giá bán</div>
              <input type="number" value={it.sellPrice} onChange={e => updateItem(i, "sellPrice", e.target.value)} style={inputStyle} />
            </div>
            {mode === "DROPSHIP" && (
              <div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--color-foreground-muted)", marginBottom: 2 }}>Giá nhập</div>
                <input type="number" value={it.buyPrice} onChange={e => updateItem(i, "buyPrice", e.target.value)} style={inputStyle} />
              </div>
            )}
            <button onClick={() => removeItem(i)} style={{ ...btnBase, color: "var(--color-destructive)", border: "none", background: "none", padding: "0 10px" }}>✕</button>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: "var(--space-3)" }}>
        <button onClick={onSubmit} disabled={pending} style={{ ...btnBase, background: "var(--color-primary)", color: "white", borderColor: "var(--color-primary)" }}>
          {pending ? "Đang tạo..." : "Tạo đơn hàng"}
        </button>
        <button onClick={() => router.push("/orders")} style={{ ...btnBase, background: "var(--color-surface)" }}>Hủy</button>
      </div>
    </div>
  );
}

function SelectField({ label, value, onChange, options, style }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; style: React.CSSProperties }) {
  return (
    <div>
      <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, marginBottom: "var(--space-1)" }}>{label}</div>
      <select value={value} onChange={e => onChange(e.target.value)} style={style}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

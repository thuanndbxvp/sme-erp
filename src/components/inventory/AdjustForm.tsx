"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adjustInventory } from "@/app/actions/inventory-actions";

interface Props {
  productId: string;
  warehouses: Array<{ id: string; code: string; name: string; qty: number }>;
}

export default function AdjustForm({ productId, warehouses }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [show, setShow] = useState(false);
  const [direction, setDirection] = useState("IN");
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [quantity, setQuantity] = useState("1");
  const [reason2, setReason2] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  function onSubmit() {
    setMsg(null);
    const fd = new FormData();
    fd.set("productId", productId);
    fd.set("warehouseId", warehouseId);
    fd.set("quantity", quantity);
    fd.set("direction", direction);
    fd.set("reason", reason2);
    fd.set("note", note);
    startTransition(async () => {
      const r = await adjustInventory(fd);
      if (r.ok) { setMsg("Đã điều chỉnh!"); setShow(false); setQuantity("1"); setReason2(""); setNote(""); router.refresh(); }
      else setMsg(r.error);
    });
  }

  const S: React.CSSProperties = { width: "100%", height: 36, padding: "0 8px", border: "1px solid var(--color-border-strong)", borderRadius: "var(--radius-sm)", fontSize: "var(--text-sm)", fontFamily: "var(--font-sans)", background: "var(--color-surface)" };

  return (
    <div style={{ marginBottom: "var(--space-6)" }}>
      {!show ? (
        <button onClick={() => setShow(true)} style={{ height: 36, padding: "0 14px", borderRadius: "var(--radius-md)", fontSize: "var(--text-xs)", fontWeight: 600, cursor: "pointer", border: "none", background: "var(--color-warning)", color: "white" }}>
          ⚠ Điều chỉnh tồn kho
        </button>
      ) : (
        <div style={{ background: "var(--color-warning-bg)", border: "1px solid var(--color-warning)", borderRadius: "var(--radius-lg)", padding: "var(--space-4)", maxWidth: 480 }}>
          <h3 style={{ fontSize: "var(--text-base)", fontWeight: 700, marginBottom: "var(--space-3)", color: "var(--color-warning)" }}>Điều chỉnh tồn kho</h3>
          {msg && <div style={{ padding: "var(--space-2)", background: msg.includes("Đã") ? "var(--color-success-bg)" : "var(--color-destructive-bg)", color: msg.includes("Đã") ? "var(--color-success)" : "var(--color-destructive)", borderRadius: "var(--radius-sm)", fontSize: "var(--text-xs)", marginBottom: "var(--space-3)" }}>{msg}</div>}
          <div style={{ display: "grid", gap: "var(--space-2)" }}>
            <select value={direction} onChange={e => setDirection(e.target.value)} style={S}>
              <option value="IN">➕ Nhập thêm (tăng tồn)</option>
              <option value="OUT">➖ Xuất bớt (giảm tồn)</option>
            </select>
            <select value={warehouseId} onChange={e => setWarehouseId(e.target.value)} style={S}>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.code} — {w.name} (hiện có: {w.qty})</option>)}
            </select>
            <input type="number" min={1} value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="Số lượng" style={S} />
            <input value={reason2} onChange={e => setReason2(e.target.value)} placeholder="Lý do: hàng hỏng, khuyến mãi, kiểm kê..." style={S} />
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="Ghi chú thêm" style={S} />
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <button onClick={onSubmit} disabled={pending} style={{ height: 36, padding: "0 14px", borderRadius: "var(--radius-sm)", fontSize: "var(--text-xs)", fontWeight: 600, cursor: "pointer", border: "none", background: "var(--color-warning)", color: "white" }}>{pending ? "..." : "Xác nhận"}</button>
              <button onClick={() => setShow(false)} style={{ height: 36, padding: "0 14px", borderRadius: "var(--radius-sm)", fontSize: "var(--text-xs)", fontWeight: 600, cursor: "pointer", border: "1px solid var(--color-border-strong)", background: "var(--color-surface)", color: "var(--color-foreground)" }}>Hủy</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

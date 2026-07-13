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
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [newQuantity, setNewQuantity] = useState<string>(
    warehouses[0] ? String(warehouses[0].qty) : "0",
  );
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const currentQty = warehouses.find((w) => w.id === warehouseId)?.qty ?? 0;

  function onSubmit() {
    setMsg(null);
    const q = parseInt(newQuantity, 10);
    if (!Number.isInteger(q) || q < 0) {
      setMsg("Số lượng mới phải là số nguyên không âm");
      return;
    }
    if (!reason.trim()) {
      setMsg("Lý do điều chỉnh là bắt buộc");
      return;
    }
    const fd = new FormData();
    fd.set("productId", productId);
    fd.set("warehouseId", warehouseId);
    fd.set("quantity", String(q));
    fd.set("reason", reason);
    startTransition(async () => {
      const r = await adjustInventory(fd);
      if (r.ok) {
        setMsg("Đã điều chỉnh!");
        setShow(false);
        setReason("");
        router.refresh();
      } else {
        setMsg(r.error ?? "Có lỗi xảy ra");
      }
    });
  }

  const S: React.CSSProperties = {
    width: "100%",
    height: 36,
    padding: "0 8px",
    border: "1px solid var(--color-border-strong)",
    borderRadius: "var(--radius-sm)",
    fontSize: "var(--text-sm)",
    fontFamily: "var(--font-sans)",
    background: "var(--color-surface)",
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setShow(!show)}
        style={{
          height: 32,
          padding: "0 12px",
          borderRadius: "var(--radius-md)",
          fontSize: "var(--text-xs)",
          fontWeight: 600,
          cursor: "pointer",
          border: "1px solid var(--color-warning)",
          background: show ? "var(--color-warning)" : "var(--color-warning)10",
          color: show ? "white" : "var(--color-warning)",
          display: "flex",
          alignItems: "center",
          gap: 6,
          transition: "all 0.2s",
        }}
      >
        ⚠ Điều chỉnh
      </button>

      {show && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            zIndex: 50,
            marginTop: "var(--space-2)",
            background: "var(--color-surface)",
            border: "2px solid var(--color-warning)",
            borderRadius: "var(--radius-lg)",
            padding: "var(--space-4)",
            width: 340,
            boxShadow: "var(--shadow-lg)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)" }}>
            <h3 style={{ fontSize: "var(--text-base)", fontWeight: 700, margin: 0, color: "var(--color-warning)" }}>Điều chỉnh tồn kho</h3>
            <button onClick={() => setShow(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16 }}>✕</button>
          </div>
          {msg && (
            <div
              style={{
                padding: "var(--space-2)",
                background: msg.includes("Đã") ? "var(--color-success-bg)" : "var(--color-destructive-bg)",
                color: msg.includes("Đã") ? "var(--color-success)" : "var(--color-destructive)",
                borderRadius: "var(--radius-sm)",
                fontSize: "var(--text-xs)",
                marginBottom: "var(--space-3)",
              }}
            >
              {msg}
            </div>
          )}
          <div style={{ display: "grid", gap: "var(--space-2)" }}>
            <select
              value={warehouseId}
              onChange={(e) => {
                const id = e.target.value;
                setWarehouseId(id);
                const w = warehouses.find((x) => x.id === id);
                setNewQuantity(w ? String(w.qty) : "0");
              }}
              style={S}
            >
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} (Tồn hiện tại: {w.qty})
                </option>
              ))}
            </select>
            <input
              type="number"
              min={0}
              value={newQuantity}
              onChange={(e) => setNewQuantity(e.target.value)}
              placeholder="Số lượng MỚI sau điều chỉnh"
              style={S}
            />
            <div style={{ fontSize: "var(--text-xs)", color: "var(--color-foreground-muted)" }}>
              Chênh lệch so với hiện tại: <strong>{parseInt(newQuantity || "0", 10) - currentQty > 0 ? "+" : ""}{parseInt(newQuantity || "0", 10) - currentQty}</strong>
            </div>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Lý do điều chỉnh (bắt buộc)"
              style={S}
            />
            <button
              onClick={onSubmit}
              disabled={pending}
              style={{
                height: 36,
                width: "100%",
                marginTop: "var(--space-2)",
                borderRadius: "var(--radius-sm)",
                fontSize: "var(--text-sm)",
                fontWeight: 700,
                cursor: "pointer",
                border: "none",
                background: "var(--color-warning)",
                color: "white",
              }}
            >
              {pending ? "..." : "Xác nhận điều chỉnh"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { editSalesOrderAction, editPurchaseOrderAction } from "@/app/(dashboard)/orders/actions";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface EditOrderItem {
  productId?: string | null;
  productName: string;
  unit: string;
  qty: number;
  sellPrice?: string;
  buyPrice?: string;
  baseCost?: string;
  taxAmount?: string;
}

export interface EditOrderInitial {
  id: string;
  orderCode: string;
  status: string;
  type: "SO" | "PO";
  items: EditOrderItem[];
  refundAccountId?: string;
}

export default function EditOrderClient({ initial, products }: { initial: EditOrderInitial; products: any[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isSO = initial.type === "SO";
  const [items, setItems] = useState<EditOrderItem[]>(
    initial.items.length > 0
      ? initial.items
      : [{ productName: "", unit: "cái", qty: 1, sellPrice: "0", buyPrice: "0", baseCost: "0" }]
  );

  function addItem() {
    setItems([...items, { productName: "", unit: "cái", qty: 1, sellPrice: isSO ? "0" : undefined, buyPrice: !isSO ? "0" : undefined, baseCost: isSO ? "0" : undefined }]);
  }
  function removeItem(i: number) {
    if (items.length > 1) setItems(items.filter((_, idx) => idx !== i));
  }
  function updateItem(i: number, f: string, v: any) {
    setItems(items.map((it, idx) => (idx === i ? { ...it, [f]: v } : it)));
  }

  function onSubmit() {
    setError(null);
    const payload = {
      items: items.map((it) => {
        const prod = products.find((p: any) => p.name === it.productName);
        return {
          productId: prod?.id ?? it.productId ?? undefined,
          productName: it.productName,
          unit: it.unit || "cái",
          qty: Number(it.qty) || 1,
          sellPrice: isSO ? String(Number(String(it.sellPrice).replace(/\D/g, "")) || 0) : "0",
          buyPrice: !isSO ? String(Number(String(it.buyPrice).replace(/\D/g, "")) || 0) : "0",
          baseCost: isSO ? String(Number(String(it.baseCost ?? it.sellPrice).replace(/\D/g, "")) || 0) : "0",
          taxAmount: "0",
        };
      }),
      refundAccountId: initial.refundAccountId,
    };

    startTransition(async () => {
      const r = isSO
        ? await editSalesOrderAction(initial.id, payload)
        : await editPurchaseOrderAction(initial.id, { items: payload.items });
      if (r.ok) {
        router.push("/orders");
        router.refresh();
      } else {
        setError(r.error);
      }
    });
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", height: 40, padding: "0 10px",
    border: "1px solid var(--color-border-strong)",
    borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)",
    fontFamily: "var(--font-sans)", background: "var(--color-surface)",
  };
  const btnBase: React.CSSProperties = {
    height: 40, padding: "0 20px", borderRadius: "var(--radius-md)",
    fontSize: "var(--text-sm)", fontWeight: 600, cursor: "pointer",
    border: "1px solid var(--color-border-strong)",
  };

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ marginBottom: "var(--space-4)" }}>
        <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, margin: 0 }}>
          Sửa {isSO ? "đơn bán" : "đơn mua"} {initial.orderCode}
        </h1>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--color-foreground-muted)", marginTop: 4 }}>
          Trạng thái hiện tại: <strong>{initial.status}</strong>. Hệ thống sẽ tự tính chênh lệch kho & quỹ.
        </p>
      </div>

      {error && (
        <div style={{ padding: "var(--space-3) var(--space-4)", background: "var(--color-destructive-bg)", color: "var(--color-destructive)", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", marginBottom: "var(--space-4)" }}>
          {error}
        </div>
      )}

      <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", overflow: "hidden", marginBottom: "var(--space-5)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "var(--space-3) var(--space-4)", borderBottom: "1px solid var(--color-border)" }}>
          <h3 style={{ fontSize: "var(--text-base)", fontWeight: 700, margin: 0 }}>Sản phẩm ({items.length})</h3>
          <button onClick={addItem} style={{ ...btnBase, background: "var(--color-surface)" }}>+ Thêm dòng</button>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--color-border)", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-foreground-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <th style={{ padding: "var(--space-2) var(--space-3)", textAlign: "left", minWidth: 200 }}>Sản phẩm</th>
              <th style={{ padding: "var(--space-2) var(--space-3)", textAlign: "center", width: 70 }}>SL</th>
              <th style={{ padding: "var(--space-2) var(--space-3)", textAlign: "left", width: 80 }}>ĐVT</th>
              {isSO ? (
                <>
                  <th style={{ padding: "var(--space-2) var(--space-3)", textAlign: "right", width: 130 }}>Giá bán</th>
                  <th style={{ padding: "var(--space-2) var(--space-3)", textAlign: "right", width: 130 }}>Giá vốn</th>
                </>
              ) : (
                <th style={{ padding: "var(--space-2) var(--space-3)", textAlign: "right", width: 130 }}>Giá nhập</th>
              )}
              <th style={{ padding: "var(--space-2) var(--space-3)", width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i} style={{ borderBottom: "1px solid var(--color-muted)" }}>
                <td style={{ padding: "var(--space-2) var(--space-3)" }}>
                  <input
                    value={it.productName}
                    onChange={(e) => updateItem(i, "productName", e.target.value)}
                    placeholder="Tên sản phẩm"
                    list="edit-products"
                    style={{ ...inputStyle, border: "none", background: "transparent" }}
                  />
                </td>
                <td style={{ padding: "var(--space-2) var(--space-3)", textAlign: "center" }}>
                  <input type="number" value={it.qty} min={1} onChange={(e) => updateItem(i, "qty", Number(e.target.value))} style={{ ...inputStyle, width: 60, textAlign: "center" }} />
                </td>
                <td style={{ padding: "var(--space-2) var(--space-3)" }}>
                  <input value={it.unit} onChange={(e) => updateItem(i, "unit", e.target.value)} style={{ ...inputStyle, width: 70 }} />
                </td>
                {isSO ? (
                  <>
                    <td style={{ padding: "var(--space-2) var(--space-3)", textAlign: "right" }}>
                      <input value={it.sellPrice ?? "0"} onChange={(e) => updateItem(i, "sellPrice", e.target.value.replace(/\D/g, ""))} style={{ ...inputStyle, width: 120, textAlign: "right" }} />
                    </td>
                    <td style={{ padding: "var(--space-2) var(--space-3)", textAlign: "right" }}>
                      <input value={it.baseCost ?? "0"} onChange={(e) => updateItem(i, "baseCost", e.target.value.replace(/\D/g, ""))} style={{ ...inputStyle, width: 120, textAlign: "right" }} />
                    </td>
                  </>
                ) : (
                  <td style={{ padding: "var(--space-2) var(--space-3)", textAlign: "right" }}>
                    <input value={it.buyPrice ?? "0"} onChange={(e) => updateItem(i, "buyPrice", e.target.value.replace(/\D/g, ""))} style={{ ...inputStyle, width: 120, textAlign: "right" }} />
                  </td>
                )}
                <td style={{ padding: "var(--space-2) var(--space-3)", textAlign: "center" }}>
                  <button onClick={() => removeItem(i)} style={{ background: "none", border: "none", color: "var(--color-destructive)", cursor: "pointer", fontSize: 18 }} title="Xóa">🗑</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <datalist id="edit-products">{products.map((p: any) => <option key={p.id} value={p.name} />)}</datalist>
      </div>

      <div style={{ display: "flex", gap: "var(--space-3)" }}>
        <button onClick={onSubmit} disabled={pending} style={{ ...btnBase, background: "var(--color-primary)", color: "white", borderColor: "var(--color-primary)" }}>
          {pending ? "Đang lưu..." : "Lưu thay đổi"}
        </button>
        <button onClick={() => router.push("/orders")} style={{ ...btnBase, background: "var(--color-surface)" }}>Hủy</button>
      </div>
    </div>
  );
}
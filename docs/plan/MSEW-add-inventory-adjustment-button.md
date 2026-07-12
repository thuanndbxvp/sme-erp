# Micro-Step Execution Workflow: Add Inventory Adjustment Button

## Bước 1: Nâng cấp AdjustForm thành Popover Modal
- **Target File:** `src/components/inventory/AdjustForm.tsx`
- **Action:** Thay thế nội dung file để giao diện Form không làm vỡ bảng khi mở, đồng thời chuẩn hóa nút "Điều chỉnh".

**Thay thế bằng đoạn code sau (Lưu ý: bọc form trong position absolute):**
```tsx
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
    <div style={{ position: "relative" }}>
      <button onClick={() => setShow(!show)} style={{ height: 32, padding: "0 12px", borderRadius: "var(--radius-md)", fontSize: "var(--text-xs)", fontWeight: 600, cursor: "pointer", border: "1px solid var(--color-warning)", background: show ? "var(--color-warning)" : "var(--color-warning)10", color: show ? "white" : "var(--color-warning)", display: "flex", alignItems: "center", gap: 6, transition: "all 0.2s" }}>
        ⚠ Điều chỉnh
      </button>

      {show && (
        <div style={{ position: "absolute", top: "100%", right: 0, zIndex: 50, marginTop: "var(--space-2)", background: "var(--color-surface)", border: "2px solid var(--color-warning)", borderRadius: "var(--radius-lg)", padding: "var(--space-4)", width: 340, boxShadow: "var(--shadow-lg)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)" }}>
             <h3 style={{ fontSize: "var(--text-base)", fontWeight: 700, margin: 0, color: "var(--color-warning)" }}>Điều chỉnh tồn kho</h3>
             <button onClick={() => setShow(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "16px" }}>✕</button>
          </div>
          {msg && <div style={{ padding: "var(--space-2)", background: msg.includes("Đã") ? "var(--color-success-bg)" : "var(--color-destructive-bg)", color: msg.includes("Đã") ? "var(--color-success)" : "var(--color-destructive)", borderRadius: "var(--radius-sm)", fontSize: "var(--text-xs)", marginBottom: "var(--space-3)" }}>{msg}</div>}
          <div style={{ display: "grid", gap: "var(--space-2)" }}>
            <select value={direction} onChange={e => setDirection(e.target.value)} style={S}>
              <option value="IN">➕ Nhập thêm</option>
              <option value="OUT">➖ Xuất bớt</option>
            </select>
            <select value={warehouseId} onChange={e => setWarehouseId(e.target.value)} style={S}>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.code} (Tồn: {w.qty})</option>)}
            </select>
            <input type="number" min={1} value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="Số lượng" style={S} />
            <input value={reason2} onChange={e => setReason2(e.target.value)} placeholder="Lý do..." style={S} />
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="Ghi chú" style={S} />
            <button onClick={onSubmit} disabled={pending} style={{ height: 36, width: "100%", marginTop: "var(--space-2)", borderRadius: "var(--radius-sm)", fontSize: "var(--text-sm)", fontWeight: 700, cursor: "pointer", border: "none", background: "var(--color-warning)", color: "white" }}>{pending ? "..." : "Xác nhận điều chỉnh"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
```

## Bước 2: Bổ sung AdjustForm vào ProductListPage
- **Target File:** `src/app/(dashboard)/catalog/product/page.tsx`
- **Action 2.1:** Thêm lệnh `import` ở đầu file (sau dòng import `Pagination`).
```tsx
import AdjustForm from "@/components/inventory/AdjustForm";
```
- **Action 2.2:** Thay thế thẻ `<td>` ở cuối bảng (nơi chứa nút Xem và Sửa - dòng 66 đến 69) bằng khối code sau, nhằm định dạng lại 3 nút cho đẹp và nhúng AdjustForm vào:

```tsx
                    <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "flex-end", alignItems: "center" }}>
                        <Link href={`/products/${p2.id}`}>
                          <button style={{ height: 32, padding: "0 12px", borderRadius: "var(--radius-md)", fontSize: "var(--text-xs)", fontWeight: 600, cursor: "pointer", border: "1px solid var(--color-primary)", background: "var(--color-surface)", color: "var(--color-primary)", display: "flex", alignItems: "center", gap: 6 }}>
                            👁 Xem
                          </button>
                        </Link>
                        <Link href={`/catalog/product/${p2.id}/edit`}>
                          <button style={{ height: 32, padding: "0 12px", borderRadius: "var(--radius-md)", fontSize: "var(--text-xs)", fontWeight: 600, cursor: "pointer", border: "1px solid var(--color-border-strong)", background: "var(--color-surface)", color: "var(--color-foreground-muted)", display: "flex", alignItems: "center", gap: 6 }}>
                            ✏ Sửa
                          </button>
                        </Link>
                        <AdjustForm 
                          productId={p2.id} 
                          warehouses={p2.inventory.map(inv => ({ id: inv.warehouseId, code: inv.warehouse.code, name: inv.warehouse.name, qty: inv.quantity }))} 
                        />
                      </div>
                    </td>
```

Sau khi gõ xong, Tầng 2 đánh dấu hoàn tất và in ra lệnh để sếp nghiệm thu.

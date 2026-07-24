"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// ====== QUICK ADD COMPONENTS ======
function QuickAddCustomer({ onDone, onCancel }: { onDone: (c: any) => void; onCancel: () => void }) {
  const [name, setName] = useState(""); const [phone, setPhone] = useState("");
  async function submit() {
    const r = await fetch("/api/quick-add", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "customer", name, phone }) });
    const data = await r.json();
    if (data.id) onDone(data);
  }
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", padding: 4 }}>
      <input placeholder="Tên KH" value={name} onChange={e => setName(e.target.value)} style={{ ...quickS, width: 140 }} />
      <input placeholder="SĐT" value={phone} onChange={e => setPhone(e.target.value)} style={{ ...quickS, width: 100 }} />
      <button onClick={submit} style={quickBtn}>Lưu</button>
      <button onClick={onCancel} style={{ ...quickBtn, background: "#eee", color: "#333" }}>✕</button>
    </div>
  );
}

function QuickAddProduct({ onDone, onCancel }: { onDone: (p: any) => void; onCancel: () => void }) {
  const [name, setName] = useState(""); const [unit, setUnit] = useState("cái");
  async function submit() {
    const r = await fetch("/api/quick-add", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "product", name, unit }) });
    const data = await r.json();
    if (data.id) onDone(data);
  }
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", padding: 4 }}>
      <input placeholder="Tên SP" value={name} onChange={e => setName(e.target.value)} style={{ ...quickS, width: 150 }} />
      <input placeholder="Đơn vị" value={unit} onChange={e => setUnit(e.target.value)} style={{ ...quickS, width: 70 }} />
      <button onClick={submit} style={quickBtn}>Lưu</button>
      <button onClick={onCancel} style={{ ...quickBtn, background: "#eee", color: "#333" }}>✕</button>
    </div>
  );
}

const quickS: React.CSSProperties = { height: 34, padding: "0 8px", border: "1px solid var(--color-border-strong)", borderRadius: "var(--radius-sm)", fontSize: "var(--text-xs)", fontFamily: "var(--font-sans)" };
const quickBtn: React.CSSProperties = { height: 34, padding: "0 12px", borderRadius: "var(--radius-sm)", fontSize: "var(--text-xs)", fontWeight: 600, cursor: "pointer", border: "none", background: "var(--color-primary)", color: "white" };

// ====== MAIN FORM ======
const S: React.CSSProperties = { width: "100%", height: 40, padding: "0 10px", border: "1px solid var(--color-border-strong)", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", fontFamily: "var(--font-sans)", background: "var(--color-surface)" };
const btn: React.CSSProperties = { height: 44, padding: "0 24px", borderRadius: "var(--radius-md)", fontSize: "var(--text-base)", fontWeight: 700, cursor: "pointer", border: "none", background: "var(--color-primary)", color: "white" };
const btnSec: React.CSSProperties = { ...btn, background: "var(--color-surface)", color: "var(--color-foreground)", border: "1px solid var(--color-border-strong)", fontWeight: 600 };

function fmtVND(v: any): string { const n = Number(String(v).replace(/\D/g, "")); return n ? n.toLocaleString("vi-VN") : ""; }

interface ItemRow { id: string; productName: string; unit: string; qty: number; buyPrice: string; sellPrice: string; baseCost: string; purchaseTaxRate: string; taxRate: string; supplierId: string }

export default function UnifiedOrderForm({ customers: initCust, suppliers: initSupp, warehouses, products: initProd, productSupplierMap = {} }: { customers: any[]; suppliers: any[]; warehouses: any[]; products: any[]; productSupplierMap?: Record<string, string[]> }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [customers, setCustomers] = useState(initCust);
  const [suppliers] = useState(initSupp);
  const [products, setProducts] = useState(initProd);
  const [addCust, setAddCust] = useState(false);
  const [addProd, setAddProd] = useState(false);

  const [mode, setMode] = useState<"DROPSHIP" | "WAREHOUSE" | "IMPORT">("IMPORT");
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "");
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "");
  const today = new Date().toISOString();
  const [saleDate, setSaleDate] = useState(today.substring(0, today.indexOf("T")));
  const [purchaseDate, setPurchaseDate] = useState(today.substring(0, today.indexOf("T")));
  const [expectedDate, setExpectedDate] = useState("");
  const [deliveredDate, setDeliveredDate] = useState("");
  const [receivedDate, setReceivedDate] = useState("");
  const [salespersonId, setSalespersonId] = useState("");
  const [commissionRate, setCommissionRate] = useState("0");
  const [commissionAmount, setCommissionAmount] = useState("0"); // MSEW-payroll-hr: hoa hồng cố định
  const [notes, setNotes] = useState("");


  // Global tax rates
  const [purchaseTaxRate, setPurchaseTaxRate] = useState("");
  const [saleTaxRate, setSaleTaxRate] = useState("");

  const [items, setItems] = useState<ItemRow[]>([{ id: "1", productName: "", unit: "cái", qty: 1, buyPrice: "", sellPrice: "", baseCost: "", purchaseTaxRate: "", taxRate: "", supplierId: suppliers[0]?.id ?? "" }]);

  function addItem() { setItems([...items, { id: String(Date.now()), productName: "", unit: "cái", qty: 1, buyPrice: "", sellPrice: "", baseCost: "", purchaseTaxRate: "", taxRate: "", supplierId: suppliers[0]?.id ?? "" }]); }
  function removeItem(id: string) { if (items.length > 1) setItems(items.filter(it => it.id !== id)); }
  function updateItem(id: string, f: string, v: any) { setItems(prev => prev.map(it => it.id === id ? { ...it, [f]: v } : it)); }
  function handleProductSelect(id: string, name: string) {
    const prod = products.find((p: any) => p.name === name);
    updateItem(id, "productName", name);
    if (prod) { updateItem(id, "unit", prod.unit || "cái"); if (!items.find(i => i.id === id)?.buyPrice) updateItem(id, "buyPrice", prod.buyPrice?.toString() || ""); if (!items.find(i => i.id === id)?.sellPrice) updateItem(id, "sellPrice", prod.sellPrice?.toString() || ""); }
  }

  const totalBuy = items.reduce((s, it) => {
    const base = (Number(String(it.buyPrice).replace(/\D/g, "")) || 0) * (Number(it.qty) || 0);
    const tax = base * (Number(it.purchaseTaxRate) || 0) / 100;
    return s + base + tax;
  }, 0);

  const totalSell = items.reduce((s, it) => {
    const base = (Number(String(it.sellPrice).replace(/\D/g, "")) || 0) * (Number(it.qty) || 0);
    const tax = base * (Number(it.taxRate) || 0) / 100;
    return s + base + tax;
  }, 0);
  const totalQty = items.reduce((s, it) => s + (Number(it.qty) || 0), 0);



  async function onSubmit() {
    setError(null);
    try {
      if (items.some(it => showBuyCol && !it.supplierId)) throw new Error("Vui lòng chọn Nhà cung cấp cho tất cả sản phẩm Mua.");

      const normalizedItems = items.map(it => ({
        productId: products.find((p: any) => p.name === it.productName)?.id || undefined,
        productName: it.productName, unit: it.unit || "cái",
        qty: Number(it.qty) || 1,
        buyPrice: String(Number(String(it.buyPrice).replace(/\D/g, "")) || 0),
        sellPrice: String(Number(String(it.sellPrice).replace(/\D/g, "")) || 0),
        baseCost: String(Number(String(it.baseCost).replace(/\D/g, "")) || Number(String(it.buyPrice).replace(/\D/g, "")) || 0),
        taxAmount: "0", taxRate: Number(it.taxRate) || 0,
        purchaseTaxRate: Number(it.purchaseTaxRate) || 0,
        supplierId: it.supplierId,
      }));

      const fd = new FormData();
      fd.set("customerId", customerId);
      fd.set("warehouseId", warehouseId);
      fd.set("saleDate", saleDate);
      fd.set("salespersonId", salespersonId);
      fd.set("items", JSON.stringify(normalizedItems));
      fd.set("mode", mode);
      fd.set("purchaseDate", purchaseDate);
      fd.set("expectedDate", expectedDate);
      fd.set("notes", notes);
      fd.set("commissionRate", commissionRate);
      fd.set("commissionAmount", String(Number(String(commissionAmount).replace(/\D/g, "")) || 0));
      fd.set("saleTaxRate", saleTaxRate);
      fd.set("purchaseTaxRate", purchaseTaxRate);


      const { createUnifiedOrder } = await import("@/app/actions/order-actions");
      startTransition(async () => {
        const r = await createUnifiedOrder(fd);
        if (r.ok) { router.push("/orders"); router.refresh(); }
        else setError(r.error);
      });
    } catch (e: any) { setError(e.message); }
  }

  const showBuyCol = mode === "DROPSHIP" || mode === "IMPORT";
  const showSellCol = mode === "DROPSHIP" || mode === "WAREHOUSE";
  const showBuySection = mode === "DROPSHIP" || mode === "IMPORT";
  const showSellSection = mode === "DROPSHIP" || mode === "WAREHOUSE";

  return (
    <div style={{ maxWidth: 1100 }}>
      {error && <ErrorBox error={error} />}

      {/* Mode + Status */}
      <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-5)", flexWrap: "wrap", alignItems: "end" }}>
        <ModeBtn active={mode === "IMPORT"} onClick={() => setMode("IMPORT")} color="#16A34A" label="🏗 Nhập kho (Mua hàng)" />
        <ModeBtn active={mode === "WAREHOUSE"} onClick={() => setMode("WAREHOUSE")} color="#2563EB" label="📦 Bán từ kho" />
        <ModeBtn active={mode === "DROPSHIP"} onClick={() => setMode("DROPSHIP")} color="#D97706" label="🔄 Dropship (Mua + Bán)" />
      </div>

      {/* 2-Column Layout for Dropship */}
      <div style={{ display: "grid", gridTemplateColumns: showBuySection && showSellSection ? "1fr 1fr" : "1fr", gap: "var(--space-5)", marginBottom: "var(--space-5)" }}>

        {/* === PURCHASE SECTION === */}
        {showBuySection && (
          <div style={{ background: "#FFF7ED", border: "1px solid #FDBA74", borderRadius: "var(--radius-lg)", padding: "var(--space-5)" }}>
            <h3 style={{ fontSize: "var(--text-base)", fontWeight: 700, color: "#C2410C", marginBottom: "var(--space-4)", borderBottom: "1px solid #FDBA74", paddingBottom: "var(--space-2)" }}>
              🛒 Thông tin Mua hàng (Đầu vào)
            </h3>
            {/* Removed Supplier dropdown */}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)", marginBottom: "var(--space-3)" }}>
              <div><label style={labelS}>Ngày đặt hàng</label><input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} style={S} /></div>
              <div><label style={labelS}>Ngày nhận TT</label><input type="date" value={receivedDate} onChange={e => setReceivedDate(e.target.value)} style={S} /></div>
            </div>

            <div style={{ marginBottom: "var(--space-3)" }}>
              <label style={labelS}>Thuế mua toàn đơn (%)</label>
              <input type="number" min="0" step="0.1" placeholder="VD: 8" value={purchaseTaxRate} onChange={e => { setPurchaseTaxRate(e.target.value); setItems(items.map(it => ({ ...it, purchaseTaxRate: e.target.value }))); }} style={S} />
            </div>

          </div>
        )}

        {/* === SALES SECTION === */}
        {showSellSection && (
          <div style={{ background: "#EFF6FF", border: "1px solid #93C5FD", borderRadius: "var(--radius-lg)", padding: "var(--space-5)" }}>
            <h3 style={{ fontSize: "var(--text-base)", fontWeight: 700, color: "#1D4ED8", marginBottom: "var(--space-4)", borderBottom: "1px solid #93C5FD", paddingBottom: "var(--space-2)" }}>
              💰 Thông tin Bán hàng (Đầu ra)
            </h3>

            {/* Customer */}
            <div style={{ marginBottom: "var(--space-3)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                <label style={{ fontSize: "var(--text-xs)", fontWeight: 600 }}>Khách hàng *</label>
                {!addCust && <button onClick={() => setAddCust(true)} style={{ fontSize: "var(--text-xs)", color: "#1D4ED8", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>+ Thêm nhanh</button>}
              </div>
              {addCust ? <QuickAddCustomer onDone={c => { setCustomers([...customers, c]); setCustomerId(c.id); setAddCust(false); }} onCancel={() => setAddCust(false)} /> :
                <select value={customerId} onChange={e => setCustomerId(e.target.value)} style={S}>
                  <option value="">-- Chọn KH --</option>
                  {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>}
            </div>

            {mode === "WAREHOUSE" && (
              <div style={{ marginBottom: "var(--space-3)" }}>
                <label style={labelS}>Kho xuất</label>
                <select value={warehouseId} onChange={e => setWarehouseId(e.target.value)} style={S}>
                  {warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-3)", marginBottom: "var(--space-3)" }}>
              <div><label style={labelS}>Ngày bán</label><input type="date" value={saleDate} onChange={e => setSaleDate(e.target.value)} style={S} /></div>
              <div><label style={labelS}>Ngày dự kiến</label><input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} style={S} /></div>
              <div><label style={labelS}>Ngày giao TT</label><input type="date" value={deliveredDate} onChange={e => setDeliveredDate(e.target.value)} style={S} /></div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)", marginBottom: "var(--space-3)" }}>
              <div><label style={labelS}>Người bán</label><input placeholder="User ID" value={salespersonId} onChange={e => setSalespersonId(e.target.value)} style={S} /></div>
              <div><label style={labelS}>Hoa hồng (%)</label><input type="number" value={commissionRate} onChange={e => setCommissionRate(e.target.value)} style={S} /></div>
              <div><label style={labelS}>Hoa hồng cố định (VND)</label><input type="text" inputMode="numeric" value={fmtVND(commissionAmount)} onChange={e => setCommissionAmount(e.target.value.replace(/\D/g, ""))} placeholder="0" style={S} /></div>
            </div>

            <div style={{ marginBottom: "var(--space-3)" }}>
              <label style={labelS}>Thuế bán toàn đơn (%)</label>
              <input type="number" min="0" step="0.1" placeholder="VD: 8" value={saleTaxRate} onChange={e => { setSaleTaxRate(e.target.value); setItems(items.map(it => ({ ...it, taxRate: e.target.value }))); }} style={S} />
            </div>

          </div>
        )}
      </div>

      {/* === ITEMS TABLE === */}
      <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", overflow: "hidden", marginBottom: "var(--space-5)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "var(--space-3) var(--space-4)", borderBottom: "1px solid var(--color-border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <h3 style={{ fontSize: "var(--text-base)", fontWeight: 700, margin: 0 }}>📋 Sản phẩm ({items.length})</h3>
            {!addProd && <button onClick={() => setAddProd(true)} style={{ fontSize: "var(--text-xs)", color: "var(--color-primary)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>+ Thêm SP nhanh</button>}
          </div>
          <button onClick={addItem} style={{ ...quickBtn, height: 34 }}>+ Thêm dòng</button>
        </div>
        {addProd && (
          <div style={{ padding: "var(--space-2) var(--space-4)", borderBottom: "1px solid var(--color-border)", background: "var(--color-surface-hover)" }}>
            <QuickAddProduct onDone={p => { setProducts([...products, p]); setAddProd(false); }} onCancel={() => setAddProd(false)} />
          </div>
        )}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)", minWidth: 750 }}>
            <thead><tr style={{ borderBottom: "1px solid var(--color-border)", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-foreground-muted)", textTransform: "uppercase", letterSpacing: "0.05em", background: "#F8FAFC" }}>
              <th style={{ padding: "var(--space-2) var(--space-3)", textAlign: "center", width: 50 }}>STT</th>
              {showBuyCol && <th style={{ padding: "var(--space-2) var(--space-3)", textAlign: "left", width: 140, color: "#C2410C" }}>Nhà cung cấp</th>}
              <th style={{ padding: "var(--space-2) var(--space-3)", textAlign: "left", minWidth: 150 }}>Sản phẩm</th>
              <th style={{ padding: "var(--space-2) var(--space-3)", textAlign: "center", width: 60 }}>SL</th>
              <th style={{ padding: "var(--space-2) var(--space-3)", textAlign: "left", width: 70 }}>ĐVT</th>
              {showBuyCol && <><th style={{ padding: "var(--space-2) var(--space-3)", textAlign: "right", width: 110, color: "#C2410C" }}>Giá Nhập</th><th style={{ padding: "var(--space-2) var(--space-3)", textAlign: "center", width: 70, color: "#C2410C" }}>Thuế NK%</th></>}
              {showSellCol && <><th style={{ padding: "var(--space-2) var(--space-3)", textAlign: "right", width: 110, color: "#1D4ED8" }}>Giá Bán</th><th style={{ padding: "var(--space-2) var(--space-3)", textAlign: "center", width: 70, color: "#1D4ED8" }}>Thuế B%</th></>}
              {showSellCol && <th style={{ padding: "var(--space-2) var(--space-3)", textAlign: "right", width: 110 }}>Thành tiền</th>}
              <th style={{ padding: "var(--space-2) var(--space-3)", textAlign: "center", width: 40 }}></th>
            </tr></thead>
            <tbody>
              {items.map((it, index) => (
                <tr key={it.id} style={{ borderBottom: "1px solid var(--color-muted)" }}>
                  <td style={{ padding: "var(--space-2) var(--space-3)", textAlign: "center" }}>{index + 1}</td>
                  {showBuyCol && <td style={{ padding: "var(--space-2) var(--space-3)" }}>
                    <select value={it.supplierId} onChange={e => updateItem(it.id, "supplierId", e.target.value)} style={{ ...S, border: "none", background: "transparent", width: "100%", padding: 0, color: "#C2410C" }}>
                      <option value="">-- Chọn NCC --</option>
                      {(() => {
                        const prod = products.find((p: any) => p.name === it.productName);
                        const histSuppliers: string[] = (prod && productSupplierMap[prod.id]) ? productSupplierMap[prod.id]! : [];
                        if (histSuppliers.length > 0) {
                          return (
                            <>
                              <optgroup label="NCC Từng giao dịch">
                                {suppliers.filter((s: any) => histSuppliers.includes(s.id)).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                              </optgroup>
                              <optgroup label="NCC Khác">
                                {suppliers.filter((s: any) => !histSuppliers.includes(s.id)).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                              </optgroup>
                            </>
                          );
                        }
                        return suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>);
                      })()}
                    </select>
                  </td>}
                  <td style={{ padding: "var(--space-2) var(--space-3)" }}>
                    <input value={it.productName} onChange={e => handleProductSelect(it.id, e.target.value)} placeholder="Chọn hoặc nhập tên..." list={`products-${index}`} style={{ ...S, border: "none", background: "transparent", width: "100%" }} />
                    <datalist id={`products-${index}`}>
                      {(it.supplierId ? products.filter((p: any) => productSupplierMap[p.id]?.includes(it.supplierId)) : products).map((p: any) => <option key={p.id} value={p.name} />)}
                    </datalist>
                  </td>
                  <td style={{ padding: "var(--space-2) var(--space-3)", textAlign: "center" }}><input type="number" value={it.qty} onChange={e => updateItem(it.id, "qty", e.target.value)} min={1} style={{ ...S, border: "none", background: "transparent", width: 55, textAlign: "center" }} /></td>
                  <td style={{ padding: "var(--space-2) var(--space-3)" }}><input value={it.unit} onChange={e => updateItem(it.id, "unit", e.target.value)} style={{ ...S, border: "none", background: "transparent", width: 60 }} /></td>
                  {showBuyCol && <><td style={{ padding: "var(--space-2) var(--space-3)", textAlign: "right" }}><input value={fmtVND(it.buyPrice)} onChange={e => updateItem(it.id, "buyPrice", e.target.value.replace(/\D/g, ""))} placeholder="0" style={{ ...S, border: "none", background: "transparent", width: 110, textAlign: "right", color: "#C2410C", fontWeight: 600 }} /></td>
                  <td style={{ padding: "var(--space-2) var(--space-3)", textAlign: "center" }}><input type="number" value={it.purchaseTaxRate} onChange={e => updateItem(it.id, "purchaseTaxRate", e.target.value)} placeholder="0" style={{ ...S, border: "none", background: "transparent", width: 60, textAlign: "center" }} /></td></>}
                  {showSellCol && <><td style={{ padding: "var(--space-2) var(--space-3)", textAlign: "right" }}><input value={fmtVND(it.sellPrice)} onChange={e => updateItem(it.id, "sellPrice", e.target.value.replace(/\D/g, ""))} placeholder="0" style={{ ...S, border: "none", background: "transparent", width: 110, textAlign: "right", color: "#1D4ED8", fontWeight: 600 }} /></td>
                  <td style={{ padding: "var(--space-2) var(--space-3)", textAlign: "center" }}><input type="number" value={it.taxRate} onChange={e => updateItem(it.id, "taxRate", e.target.value)} placeholder="0" style={{ ...S, border: "none", background: "transparent", width: 60, textAlign: "center" }} /></td></>}
                  {showSellCol && <td style={{ padding: "var(--space-2) var(--space-3)", textAlign: "right", fontWeight: 700, whiteSpace: "nowrap" }}>{(Number(String(it.sellPrice).replace(/\D/g, "")) * (Number(it.qty) || 1) || 0).toLocaleString("vi-VN")} đ</td>}
                  <td style={{ padding: "var(--space-2) var(--space-3)", textAlign: "center" }}><button onClick={() => removeItem(it.id)} style={{ background: "none", border: "none", color: "var(--color-destructive)", cursor: "pointer", fontSize: 18, padding: 2 }} title="Xóa">🗑</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Totals */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "var(--space-3)", marginBottom: "var(--space-5)", fontSize: "var(--text-sm)" }}>
        <TotalBox label="Tổng SL" value={String(totalQty)} />
        {showBuySection && <TotalBox label="Tổng nhập" value={totalBuy.toLocaleString("vi-VN") + " đ"} color="#C2410C" />}
        {showSellSection && <TotalBox label="Tổng bán" value={totalSell.toLocaleString("vi-VN") + " đ"} color="#1D4ED8" />}
        {showBuySection && showSellSection && <TotalBox label="Lãi dự kiến" value={(totalSell - totalBuy).toLocaleString("vi-VN") + " đ"} color="var(--color-success)" />}
      </div>

      {/* Notes */}
      <div style={{ marginBottom: "var(--space-5)" }}>
        <label style={labelS}>Ghi chú</label>
        <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ghi chú đơn hàng..." style={S} />
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: "var(--space-3)" }}>
        <button onClick={onSubmit} disabled={pending} style={btn}>
          {pending ? "⏳ Đang tạo..." : mode === "DROPSHIP" ? "🚀 Tạo đơn Dropship (Mua + Bán)" : mode === "WAREHOUSE" ? "📦 Tạo đơn Bán từ kho" : "🏗 Tạo đơn Nhập kho"}
        </button>
        <button onClick={() => router.push("/orders")} style={btnSec}>Hủy</button>
      </div>
    </div>
  );
}

// ====== SUB-COMPONENTS ======
function ModeBtn({ active, onClick, color, label }: { active: boolean; onClick: () => void; color: string; label: string }) {
  return <button onClick={onClick} style={{ ...btnSec, height: 38, fontSize: "var(--text-sm)", background: active ? color : "var(--color-surface)", color: active ? "white" : "var(--color-foreground)", borderColor: active ? color : "var(--color-border-strong)" }}>{label}</button>;
}

const labelS: React.CSSProperties = { fontSize: "var(--text-xs)", fontWeight: 600, display: "block", marginBottom: 2 };

function TotalBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "var(--space-3)", textAlign: "center" }}><div style={{ fontSize: "var(--text-xs)", color: "var(--color-foreground-muted)" }}>{label}</div><div style={{ fontWeight: 700, color: color || "var(--color-foreground)" }}>{value}</div></div>;
}

function ErrorBox({ error }: { error: string }) {
  return <div style={{ padding: "var(--space-3) var(--space-4)", background: "var(--color-destructive-bg)", color: "var(--color-destructive)", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", marginBottom: "var(--space-4)", border: "1px solid var(--color-destructive)" }}>{error}</div>;
}



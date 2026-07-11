"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordPayment } from "@/app/actions/order-actions";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Invoice {
  id: string; invoiceNumber: string; type: string; status: string;
  totalAmount: string; paidAmount: string; balanceDue: string;
  customer?: { id: string; name: string } | null;
  supplier?: { id: string; name: string } | null;
  salesOrder?: { orderCode: string } | null;
  purchaseOrder?: { orderCode: string } | null;
}

interface Props {
  accounts: any[];
  arInvoices: Invoice[];
  apInvoices: Invoice[];
}

export default function PaymentForm({ accounts, arInvoices, apInvoices }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [show, setShow] = useState(false);
  const [direction, setDirection] = useState<"IN" | "OUT">("IN");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [selectedInvoices, setSelected] = useState<Array<{ invoiceId: string; amount: string; label: string }>>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const invoices = direction === "IN" ? arInvoices : apInvoices;

  function toggleInvoice(inv: Invoice) {
    const exists = selectedInvoices.find(s => s.invoiceId === inv.id);
    if (exists) {
      setSelected(selectedInvoices.filter(s => s.invoiceId !== inv.id));
    } else {
      setSelected([...selectedInvoices, { invoiceId: inv.id, amount: inv.balanceDue.toString(), label: `${inv.invoiceNumber} — ${direction === "IN" ? inv.customer?.name : inv.supplier?.name} (${Number(inv.balanceDue).toLocaleString("vi-VN")} đ)` }]);
    }
  }

  function updateAmount(invoiceId: string, amount: string) {
    setSelected(selectedInvoices.map(s => s.invoiceId === invoiceId ? { ...s, amount } : s));
  }

  const totalSelected = selectedInvoices.reduce((s, inv) => s + (Number(inv.amount) || 0), 0);

  function onSubmit() {
    setMsg(null);
    const fd = new FormData();
    fd.set("direction", direction);
    fd.set("amount", String(totalSelected));
    fd.set("accountId", accountId);
    fd.set("applications", JSON.stringify(selectedInvoices.map(s => ({ invoiceId: s.invoiceId, appliedAmount: s.amount }))));
    fd.set("description", `Thanh toán ${selectedInvoices.length} hóa đơn`);
    startTransition(async () => {
      const r = await recordPayment(fd);
      if (r.ok) { setMsg("Đã ghi nhận thanh toán!"); setShow(false); setSelected([]); router.refresh(); }
      else setMsg(r.error);
    });
  }

  const S: React.CSSProperties = { width: "100%", height: 36, padding: "0 10px", border: "1px solid var(--color-border-strong)", borderRadius: "var(--radius-sm)", fontSize: "var(--text-sm)", fontFamily: "var(--font-sans)", background: "var(--color-surface)" };

  return (
    <div style={{ marginTop: "var(--space-6)" }}>
      {!show ? (
        <button onClick={() => setShow(true)} style={{ height: 44, padding: "0 20px", borderRadius: "var(--radius-md)", fontSize: "var(--text-base)", fontWeight: 700, cursor: "pointer", border: "none", background: "var(--color-primary)", color: "white" }}>
          💳 Ghi nhận thanh toán
        </button>
      ) : (
        <div style={{ background: "var(--color-surface)", border: "2px solid var(--color-primary)", borderRadius: "var(--radius-lg)", padding: "var(--space-6)", maxWidth: 700 }}>
          <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700, marginBottom: "var(--space-4)" }}>Ghi nhận thanh toán</h2>
          {msg && <div style={{ padding: "var(--space-3)", background: msg.includes("Đã") ? "var(--color-success-bg)" : "var(--color-destructive-bg)", color: msg.includes("Đã") ? "var(--color-success)" : "var(--color-destructive)", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", marginBottom: "var(--space-4)" }}>{msg}</div>}
          <div style={{ display: "grid", gap: "var(--space-4)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
              <div>
                <label style={{ fontSize: "var(--text-xs)", fontWeight: 600, display: "block", marginBottom: 2 }}>Loại</label>
                <select value={direction} onChange={e => { setDirection(e.target.value as "IN" | "OUT"); setSelected([]); }} style={S}>
                  <option value="IN">💰 Thu tiền KH (AR)</option>
                  <option value="OUT">💸 Trả tiền NCC (AP)</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: "var(--text-xs)", fontWeight: 600, display: "block", marginBottom: 2 }}>Tài khoản</label>
                <select value={accountId} onChange={e => setAccountId(e.target.value)} style={S}>
                  {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.code} — {a.name} ({Number(a.balance).toLocaleString("vi-VN")} đ)</option>)}
                </select>
              </div>
            </div>

            {/* Invoice selector */}
            <div>
              <label style={{ fontSize: "var(--text-xs)", fontWeight: 600, display: "block", marginBottom: 4 }}>
                Chọn hóa đơn ({selectedInvoices.length} đã chọn — Tổng: {totalSelected.toLocaleString("vi-VN")} đ)
              </label>
              <div style={{ maxHeight: 300, overflowY: "auto", border: "1px solid var(--color-border-strong)", borderRadius: "var(--radius-md)" }}>
                {invoices.length === 0 ? (
                  <div style={{ padding: "var(--space-4)", textAlign: "center", color: "var(--color-foreground-muted)", fontSize: "var(--text-sm)" }}>
                    Không có hóa đơn {direction === "IN" ? "phải thu" : "phải trả"} nào đang mở
                  </div>
                ) : invoices.map(inv => {
                  const sel = selectedInvoices.find(s => s.invoiceId === inv.id);
                  return (
                    <div key={inv.id} style={{ padding: "var(--space-2) var(--space-3)", display: "flex", alignItems: "center", gap: "var(--space-3)", borderBottom: "1px solid var(--color-muted)", background: sel ? "var(--color-primary)08" : "transparent" }}>
                      <input type="checkbox" checked={!!sel} onChange={() => toggleInvoice(inv)} style={{ width: 18, height: 18, cursor: "pointer" }} />
                      <div style={{ flex: 1, fontSize: "var(--text-sm)" }}>
                        <strong>{inv.invoiceNumber}</strong> — {direction === "IN" ? inv.customer?.name : inv.supplier?.name}
                        <br /><span style={{ fontSize: "var(--text-xs)", color: "var(--color-foreground-muted)" }}>{inv.salesOrder?.orderCode || inv.purchaseOrder?.orderCode || "—"} · Đã trả: {Number(inv.paidAmount).toLocaleString("vi-VN")} · Còn: <strong style={{ color: "var(--color-destructive)" }}>{Number(inv.balanceDue).toLocaleString("vi-VN")} đ</strong></span>
                      </div>
                      {sel && (
                        <input type="number" value={sel.amount} onChange={e => updateAmount(inv.id, e.target.value)} style={{ ...S, width: 130, textAlign: "right" }} placeholder="Số tiền" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "flex", gap: "var(--space-3)" }}>
              <button onClick={onSubmit} disabled={pending || selectedInvoices.length === 0} style={{ height: 44, padding: "0 24px", borderRadius: "var(--radius-md)", fontSize: "var(--text-base)", fontWeight: 700, cursor: "pointer", border: "none", background: "var(--color-primary)", color: "white", opacity: selectedInvoices.length === 0 ? 0.5 : 1 }}>
                {pending ? "⏳ Đang xử lý..." : `✅ Xác nhận thanh toán ${totalSelected.toLocaleString("vi-VN")} đ`}
              </button>
              <button onClick={() => { setShow(false); setSelected([]); }} style={{ height: 44, padding: "0 20px", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", fontWeight: 600, cursor: "pointer", border: "1px solid var(--color-border-strong)", background: "var(--color-surface)", color: "var(--color-foreground)" }}>Hủy</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

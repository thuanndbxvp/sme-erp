"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { deliverOrder, cancelOrder, receiveOrder } from "@/app/actions/order-actions";
import Link from "next/link";

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function OrderTabsClient({ salesOrders, purchaseOrders, initialTab, currentPage, totalPages, soCount, poCount }: { salesOrders: any[]; purchaseOrders: any[]; initialTab: "SO" | "PO"; currentPage: number; totalPages: number; soCount: number; poCount: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    action: "DELIVER" | "CANCEL" | "RECEIVE";
    orderId: string;
    orderCode: string;
  } | null>(null);

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const orders = initialTab === "SO" ? salesOrders : purchaseOrders;
  const label = initialTab === "SO" ? "Đơn bán" : "Đơn mua";

  function confirmAction(action: "DELIVER" | "CANCEL" | "RECEIVE", orderId: string, orderCode: string) {
    setConfirmModal({ isOpen: true, action, orderId, orderCode });
    setPassword("");
    setError(null);
  }

  function executeAction() {
    if (!confirmModal) return;
    const { action, orderId } = confirmModal;
    
    if (action === "CANCEL" && !password) {
      setError("Vui lòng nhập mật khẩu xác nhận.");
      return;
    }
    
    startTransition(async () => {
      setError(null);
      const fd = new FormData();
      fd.set("id", orderId);
      
      let res;
      if (action === "DELIVER") {
        res = await deliverOrder(fd);
      } else if (action === "RECEIVE") {
        res = await receiveOrder(fd);
      } else {
        fd.set("type", initialTab);
        fd.set("password", password);
        res = await cancelOrder(fd);
      }

      if (res && res.ok === false) {
        setError(res.error);
        return;
      }

      setConfirmModal(null);
      setPassword("");
      router.refresh();
    });
  }

  function changeTab(t: "SO" | "PO") {
    startTransition(() => {
      router.push(`?tab=${t}&page=1`);
    });
  }

  function changePage(p: number) {
    startTransition(() => {
      router.push(`?tab=${initialTab}&page=${p}`);
    });
  }

  const statusColor = (s: string) => {
    if (s === "DELIVERED" || s === "RECEIVED") return "var(--color-success)";
    if (s === "CANCELLED") return "var(--color-destructive)";
    return "var(--color-warning)";
  };

  return (
    <div>
      {/* Action bar */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-4)" }}>
        <Link href="/orders/new" style={{ height: 40, padding: "0 20px", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", fontWeight: 600, background: "var(--color-primary)", color: "white", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", textDecoration: "none" }}>+ Tạo đơn mới</Link>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: "var(--space-5)", borderBottom: "2px solid var(--color-border)" }}>
        {(["SO", "PO"] as const).map((t) => (
          <button
            key={t}
            onClick={() => changeTab(t)}
            style={{
              padding: "var(--space-3) var(--space-5)",
              background: "none",
              border: "none",
              borderBottom: initialTab === t ? "2px solid var(--color-primary)" : "2px solid transparent",
              marginBottom: -2,
              fontWeight: initialTab === t ? 600 : 400,
              color: initialTab === t ? "var(--color-primary)" : "var(--color-foreground-muted)",
              fontSize: "var(--text-sm)",
              cursor: "pointer",
            }}
          >
            {t === "SO" ? "Đơn bán" : "Đơn mua"} ({t === "SO" ? soCount : poCount})
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", overflow: "hidden", boxShadow: "var(--shadow-sm)", opacity: pending ? 0.7 : 1, transition: "opacity 0.2s" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)", fontVariantNumeric: "tabular-nums" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--color-border)", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-foreground-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center", width: 50 }}>STT</th>
              <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Mã</th>
              <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>{initialTab === "SO" ? "Khách hàng" : "Nhà cung cấp"}</th>
              <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Sản phẩm</th>
              <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>Tổng tiền</th>
              <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}>Trạng thái</th>
              <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}>Thanh toán</th>
              <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>Ngày</th>
              <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center", width: 150 }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr><td colSpan={9} style={{ padding: "var(--space-10)", textAlign: "center", color: "var(--color-foreground-muted)" }}>Chưa có {label.toLowerCase()} nào</td></tr>
            ) : orders.map((o, i) => (
              <tr key={o.id} style={{ borderBottom: i < orders.length - 1 ? "1px solid var(--color-muted)" : "none", background: i % 2 === 0 ? "var(--color-surface)" : "var(--color-surface-hover)" }}>
                <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}>{(currentPage - 1) * 20 + i + 1}</td>
                <td style={{ padding: "var(--space-3) var(--space-4)", fontWeight: 500, whiteSpace: "nowrap" }}>{o.orderCode}</td>
                <td style={{ padding: "var(--space-3) var(--space-4)" }}>{initialTab === "SO" ? o.customer?.name ?? "—" : o.supplier?.name ?? "—"}</td>
                <td style={{ padding: "var(--space-3) var(--space-4)", fontSize: "var(--text-xs)", color: "var(--color-foreground-muted)" }}>
                  {o.items?.slice(0, 3).map((it: any) => `${it.productName} x${it.qty}`).join(", ") ?? "—"}
                  {(o.items?.length ?? 0) > 3 ? ` +${o.items.length - 3}` : ""}
                </td>
                <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right", fontWeight: 600, whiteSpace: "nowrap" }}>{Number(o.totalAmount).toLocaleString("vi-VN")} đ</td>
                <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}>
                  <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: "var(--radius-sm)", fontSize: "var(--text-xs)", fontWeight: 600, background: statusColor(o.status) + "20", color: statusColor(o.status) }}>
                    {o.status}
                  </span>
                </td>
                <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center", fontSize: "var(--text-xs)" }}>{o.paymentStatus}</td>
                <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right", fontSize: "var(--text-xs)", whiteSpace: "nowrap" }}>
                  {o.saleDate ? new Date(o.saleDate).toLocaleDateString("vi-VN") : o.orderDate ? new Date(o.orderDate).toLocaleDateString("vi-VN") : "—"}
                </td>
                <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center", whiteSpace: "nowrap" }}>
                  {(o.status === "PENDING" || o.status === "ORDERED") && (
                    <Link href={`/orders/edit/${o.id}?type=${initialTab}`} style={{ fontSize: "var(--text-xs)", padding: "2px 8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-primary)", background: "var(--color-primary)", color: "white", cursor: "pointer", marginRight: 4, textDecoration: "none", display: "inline-block" }}>Sửa</Link>
                  )}
                  {o.status === "PENDING" && initialTab === "SO" && (
                    <button onClick={() => confirmAction("DELIVER", o.id, o.orderCode)} disabled={pending} style={{ fontSize: "var(--text-xs)", padding: "2px 8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-success)", background: "var(--color-success-bg)", color: "var(--color-success)", cursor: "pointer", marginRight: 4 }}>Giao hàng</button>
                  )}
                  {o.status === "ORDERED" && initialTab === "PO" && (
                    <button onClick={() => confirmAction("RECEIVE", o.id, o.orderCode)} disabled={pending} style={{ fontSize: "var(--text-xs)", padding: "2px 8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-success)", background: "var(--color-success-bg)", color: "var(--color-success)", cursor: "pointer", marginRight: 4 }}>Nhận hàng</button>
                  )}
                  {(o.status === "PENDING" || o.status === "ORDERED" || o.status === "DELIVERED" || o.status === "RECEIVED") && (
                    <button onClick={() => confirmAction("CANCEL", o.id, o.orderCode)} disabled={pending} style={{ fontSize: "var(--text-xs)", padding: "2px 8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-destructive)", background: "var(--color-destructive-bg)", color: "var(--color-destructive)", cursor: "pointer" }}>Hủy</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "var(--space-4)", fontSize: "var(--text-sm)" }}>
          <div style={{ color: "var(--color-foreground-muted)" }}>
            Trang {currentPage} / {totalPages}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => changePage(currentPage - 1)}
              disabled={currentPage <= 1 || pending}
              style={{ padding: "4px 12px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", background: "var(--color-surface)", cursor: currentPage <= 1 ? "not-allowed" : "pointer", opacity: currentPage <= 1 ? 0.5 : 1 }}
            >
              Trước
            </button>
            <button
              onClick={() => changePage(currentPage + 1)}
              disabled={currentPage >= totalPages || pending}
              style={{ padding: "4px 12px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", background: "var(--color-surface)", cursor: currentPage >= totalPages ? "not-allowed" : "pointer", opacity: currentPage >= totalPages ? 0.5 : 1 }}
            >
              Sau
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "var(--color-surface)", width: 450, borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-lg)", overflow: "hidden" }}>
            <div style={{ padding: "var(--space-4)", borderBottom: "1px solid var(--color-border)" }}>
              <h3 style={{ margin: 0, fontSize: "var(--text-lg)" }}>
                {confirmModal.action === "DELIVER" ? "Xác nhận Giao hàng" : confirmModal.action === "RECEIVE" ? "Xác nhận Nhận hàng" : "Xác nhận Hủy đơn"}
              </h3>
            </div>
            
            <div style={{ padding: "var(--space-4)", fontSize: "var(--text-sm)", color: "var(--color-foreground)", lineHeight: 1.6 }}>
              <p style={{ margin: "0 0 12px 0", fontWeight: 600 }}>
                Bạn có chắc chắn muốn {confirmModal.action === "DELIVER" ? "giao" : confirmModal.action === "RECEIVE" ? "nhận" : "hủy"} đơn hàng <span style={{ color: "var(--color-primary)" }}>{confirmModal.orderCode}</span>?
              </p>
              
              <div style={{ background: "var(--color-surface-hover)", padding: "var(--space-3)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", marginBottom: confirmModal.action === "CANCEL" ? "var(--space-4)" : 0 }}>
                <p style={{ margin: "0 0 8px 0", fontWeight: 600, color: "var(--color-warning)" }}>⚠️ Tác động đến hệ thống:</p>
                <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 }}>
                  {confirmModal.action === "DELIVER" ? (
                    <>
                      <li><strong>Trạng thái:</strong> Chuyển sang DELIVERED. Nếu là đơn Dropship, hệ thống sẽ tự động cập nhật đơn mua liên kết thành Đã nhận hàng.</li>
                      <li><strong>Kho hàng:</strong> Trừ số lượng tồn kho tương ứng của các sản phẩm trong đơn (trừ phi là Dropship).</li>
                      <li><strong>Tài chính:</strong> Ghi nhận doanh thu, tính toán lãi gộp và tự động cộng vào Công nợ phải thu (AR) của khách hàng.</li>
                    </>
                  ) : confirmModal.action === "RECEIVE" ? (
                    <>
                      <li><strong>Trạng thái:</strong> Chuyển sang RECEIVED.</li>
                      <li><strong>Kho hàng:</strong> Cộng số lượng tồn kho tương ứng của các sản phẩm trong đơn mua.</li>
                      <li><strong>Tài chính:</strong> Ghi nhận chi phí mua hàng và cộng vào Công nợ phải trả (AP) của nhà cung cấp.</li>
                    </>
                  ) : (
                    <>
                      <li><strong>Trạng thái:</strong> Chuyển sang CANCELLED.</li>
                      <li><strong>Kho hàng:</strong> Hoàn lại số lượng tồn kho (nếu đơn hàng đã được giao/nhận trước đó).</li>
                      <li><strong>Tài chính:</strong> Xóa bỏ công nợ tương ứng (AR/AP). Thu hồi doanh thu/lãi gộp đã ghi nhận.</li>
                      <li><strong>Dòng tiền:</strong> Nếu đơn đã được thanh toán, số tiền đã trả sẽ trở thành khoản dư (cần hoàn trả hoặc cấn trừ).</li>
                      {confirmModal.action === "CANCEL" && initialTab === "PO" && (
                        <li style={{ color: "var(--color-destructive)" }}><strong>Lưu ý Dropship:</strong> Nếu đây là đơn mua Dropship, hệ thống sẽ <b>tự động HỦY luôn đơn bán liên kết</b> với đơn mua này.</li>
                      )}
                    </>
                  )}
                </ul>
              </div>

              {confirmModal.action === "CANCEL" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>Mật khẩu xác nhận</label>
                  <input
                    type="password"
                    placeholder="Nhập mật khẩu để tiếp tục"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{ padding: "8px 12px", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "var(--color-surface)", fontSize: "var(--text-sm)" }}
                  />
                  {error && <p style={{ margin: "4px 0 0 0", color: "var(--color-destructive)", fontSize: "var(--text-xs)" }}>{error}</p>}
                </div>
              )}
            </div>

            <div style={{ padding: "var(--space-3) var(--space-4)", borderTop: "1px solid var(--color-border)", display: "flex", justifyContent: "flex-end", gap: 12, background: "var(--color-surface-hover)" }}>
              <button 
                onClick={() => { setConfirmModal(null); setPassword(""); setError(null); }} 
                disabled={pending}
                style={{ padding: "8px 16px", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "var(--color-surface)", cursor: "pointer", fontWeight: 500 }}
              >
                Đóng
              </button>
              <button 
                onClick={executeAction} 
                disabled={pending}
                style={{ padding: "8px 16px", borderRadius: "var(--radius-md)", border: "none", background: confirmModal.action === "CANCEL" ? "var(--color-destructive)" : "var(--color-success)", color: "white", cursor: "pointer", fontWeight: 600 }}
              >
                {pending ? "Đang xử lý..." : "Xác nhận"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

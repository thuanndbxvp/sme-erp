"use client";

import { useState } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface AuditLog { id: string; action: string; entityType: string; entityId: string; userId: string | null; userName: string; createdAt: Date; metadata?: any; }

interface Props { logs: AuditLog[]; }

const ACTION_MAP: Record<string, string> = {
  CREATE: "TẠO MỚI",
  UPDATE: "CẬP NHẬT",
  DELETE: "XÓA",
  CANCEL: "HỦY BỎ",
  APPROVE: "PHÊ DUYỆT",
  LOGIN: "ĐĂNG NHẬP",
  LOGOUT: "ĐĂNG XUẤT",
  PAY: "THANH TOÁN",
  REFUND: "HOÀN TIỀN"
};

const ENTITY_MAP: Record<string, string> = {
  TRANSACTION: "GIAO DỊCH TIỀN",
  Transaction: "GIAO DỊCH",
  InventoryMovement: "BIẾN ĐỘNG KHO",
  SalesOrder: "ĐƠN BÁN HÀNG",
  PurchaseOrder: "ĐƠN MUA HÀNG",
  Product: "SẢN PHẨM",
  WarehouseInventory: "TỒN KHO",
  User: "NGƯỜI DÙNG",
  Role: "NHÓM QUYỀN",
  Supplier: "NHÀ CUNG CẤP",
  Customer: "KHÁCH HÀNG",
  Invoice: "HÓA ĐƠN CÔNG NỢ",
  PaymentApplication: "GẠCH NỢ",
  Warehouse: "KHO HÀNG",
  CashAccount: "QUỸ TIỀN",
  Account: "TÀI KHOẢN TÀI CHÍNH",
  AuditLog: "NHẬT KÝ",
  Payout: "BẢNG LƯƠNG/HOA HỒNG",
  CommissionRule: "CẤU HÌNH HOA HỒNG",
  EmployeeTransaction: "GIAO DỊCH NHÂN VIÊN"
};

const META_KEYS_MAP: Record<string, string> = {
  type: "Phân loại",
  amount: "Số tiền",
  accountId: "Mã Quỹ",
  reason: "Lý do phát sinh",
  quantity: "Số lượng",
  orderCode: "Mã chứng từ",
  adjustType: "Thao tác điều chỉnh",
  oldQty: "Tồn kho cũ",
  newQty: "Tồn kho mới",
  oldQuantity: "Tồn kho cũ",
  newQuantity: "Tồn kho mới",
  delta: "Mức thay đổi",
  productId: "Mã sản phẩm",
  warehouseId: "Mã kho hàng",
  productName: "Tên sản phẩm",
  warehouseName: "Tên kho hàng",
  message: "Ghi chú hệ thống",
  note: "Ghi chú của người dùng",
  status: "Trạng thái hiện tại",
  fromStatus: "Từ trạng thái",
  toStatus: "Chuyển sang trạng thái",
  balanceDue: "Dư nợ cần thu/trả",
  totalAmount: "Tổng giá trị",
  email: "Tài khoản Email",
  role: "Vai trò",
  fulfillmentType: "Hình thức giao nhận",
  buyPrice: "Giá nhập mới",
  sellPrice: "Giá bán mới",
  customerName: "Tên khách hàng",
  supplierName: "Tên nhà cung cấp",
  salespersonId: "Mã nhân viên"
};

const REASON_LABELS: Record<string, string> = {
  INITIAL_BALANCE: "Khai báo tồn kho đầu kỳ",
  PURCHASE_RECEIPT: "Nhập kho (Mua hàng)",
  SALES_SHIPMENT: "Xuất kho (Bán hàng)",
  RETURN_IN: "Nhập lại kho (Khách trả hàng)",
  RETURN_OUT: "Xuất kho (Trả hàng nhà cung cấp)",
  ADJUST_IN: "Điều chỉnh kiểm kê (Tăng)",
  ADJUST_OUT: "Điều chỉnh kiểm kê (Giảm)",
  DROPSHIP_IN: "Nhập hàng ảo (Giao thẳng)",
  DROPSHIP_OUT: "Xuất hàng ảo (Giao thẳng)",
};

const VALUE_MAP: Record<string, string> = {
  "IN": "Tăng (Thu tiền/Nhập kho)",
  "OUT": "Giảm (Chi tiền/Xuất kho)",
  "AR": "Phiếu phải thu",
  "AP": "Phiếu phải trả",
  "PENDING": "Đang chờ xử lý",
  "ORDERED": "Đã đặt hàng xong",
  "RECEIVED": "Đã nhập kho xong",
  "DELIVERED": "Đã giao hàng xong",
  "CANCELLED": "Đã bị hủy bỏ",
  "OPEN": "Chưa thanh toán",
  "PARTIAL": "Thanh toán một phần",
  "PAID": "Đã thanh toán xong",
  "DROPSHIP": "Giao thẳng từ NCC",
  "STOCK": "Giao từ kho công ty",
  "WAREHOUSE": "Giao từ kho công ty"
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatMetadata(meta: any) {
  if (!meta || Object.keys(meta).length === 0) return "—";
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", alignItems: "center", marginTop: 4 }}>
      {Object.entries(meta).map(([k, v]) => {
        const key = META_KEYS_MAP[k] || k;
        let value = String(v);

        // Xử lý các mã ID dài để tránh người dùng thấy quá nhiều mã kỹ thuật
        if (value.startsWith("cmr") && value.length > 20) {
          value = `Mã: ${value.substring(value.length - 6).toUpperCase()}`; 
        } else if (k === "amount" || k === "totalAmount" || k === "balanceDue" || k === "buyPrice" || k === "sellPrice") {
          const num = Number(value);
          if (!isNaN(num)) value = num.toLocaleString("vi-VN") + " đ";
        } else {
          if (k === "reason" && REASON_LABELS[value]) value = REASON_LABELS[value] as string;
          else if (VALUE_MAP[value]) value = VALUE_MAP[value] as string;
        }

        return (
          <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "var(--color-surface-hover)", padding: "2px 8px", borderRadius: 6, border: "1px solid var(--color-border)", fontSize: "0.8rem" }}>
            <span style={{ color: "var(--color-foreground-muted)" }}>{key}:</span>
            <b style={{ color: "var(--color-foreground)" }}>{value}</b>
          </span>
        );
      })}
    </div>
  );
}

export default function AuditTable({ logs }: Props) {
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;
  const totalPages = Math.ceil(logs.length / pageSize);
  const displayData = logs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <>
      <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)", fontVariantNumeric: "tabular-nums" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--color-border)", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-foreground-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center", width: 50 }}>STT</th>
              <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left", width: 160 }}>Người thực hiện</th>
              <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left", width: 130 }}>Thao tác</th>
              <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left", width: 180 }}>Chuyên mục</th>
              <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Thông tin chi tiết</th>
              <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right", width: 160 }}>Thời điểm</th>
            </tr>
          </thead>
          <tbody>
            {displayData.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: "var(--space-10)", textAlign: "center", color: "var(--color-foreground-muted)" }}>Chưa có hoạt động nào</td>
              </tr>
            ) : (
              displayData.map((log, i) => {
                const shortId = log.entityId.substring(log.entityId.length - 6).toUpperCase();
                return (
                  <tr key={log.id} style={{ borderBottom: i < displayData.length - 1 ? "1px solid var(--color-muted)" : "none", background: i % 2 === 0 ? "var(--color-surface)" : "var(--color-surface-hover)" }}>
                    <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}>{(currentPage - 1) * pageSize + i + 1}</td>
                    <td style={{ padding: "var(--space-3) var(--space-4)", fontWeight: 600 }}>{log.userName}</td>
                    <td style={{ padding: "var(--space-3) var(--space-4)", fontWeight: 600, color: log.action === "DELETE" ? "var(--color-destructive)" : log.action === "CREATE" ? "var(--color-success)" : "var(--color-warning)" }}>{ACTION_MAP[log.action] || log.action}</td>
                    <td style={{ padding: "var(--space-3) var(--space-4)", fontWeight: 500 }}>{ENTITY_MAP[log.entityType] || log.entityType}</td>
                    <td style={{ padding: "var(--space-3) var(--space-4)" }}>
                      <div style={{ marginBottom: 4, fontSize: "0.75rem", color: "var(--color-muted-foreground)" }}>
                        ID Hệ thống: <span title={log.entityId} style={{ background: "var(--color-muted)", padding: "1px 4px", borderRadius: 4, fontFamily: "var(--font-mono)" }}>#{shortId}</span>
                      </div>
                      {formatMetadata(log.metadata)}
                    </td>
                    <td style={{ padding: "var(--space-3) var(--space-4)", whiteSpace: "nowrap", textAlign: "right", fontSize: "0.8rem", color: "var(--color-foreground-muted)" }}>{new Date(log.createdAt).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" })}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "var(--space-2)", padding: "var(--space-3)", borderTop: "1px solid var(--color-border)" }}>
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} style={{ padding: "var(--space-1) var(--space-3)", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)", background: "var(--color-surface)", cursor: currentPage === 1 ? "not-allowed" : "pointer", opacity: currentPage === 1 ? 0.5 : 1 }}>‹</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button key={p} onClick={() => setCurrentPage(p)} style={{ padding: "var(--space-1) var(--space-2)", minWidth: 32, borderRadius: "var(--radius-sm)", border: "1px solid", borderColor: p === currentPage ? "var(--color-primary)" : "var(--color-border)", background: p === currentPage ? "var(--color-primary)" : "var(--color-surface)", color: p === currentPage ? "white" : "var(--color-foreground)", cursor: "pointer", fontSize: "var(--text-xs)" }}>{p}</button>
            ))}
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} style={{ padding: "var(--space-1) var(--space-3)", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)", background: "var(--color-surface)", cursor: currentPage === totalPages ? "not-allowed" : "pointer", opacity: currentPage === totalPages ? 0.5 : 1 }}>›</button>
          </div>
        )}
      </div>
    </>
  );
}

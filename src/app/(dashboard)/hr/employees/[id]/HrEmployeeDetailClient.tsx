"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSalaryAdvanceAction, approveCommissionAction, updateEmployeeProfileAction, getDraftPayslip, finalizePayrollAction } from "@/app/actions/hr-actions";

/* eslint-disable @typescript-eslint/no-explicit-any */

const modalOverlay: React.CSSProperties = { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 };

export default function HrEmployeeDetailClient({
  user,
  advances,
  commissions,
  accounts,
  payslips,
}: {
  user: any;
  advances: any[];
  commissions: any[];
  accounts: any[];
  payslips: any[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [openAdvance, setOpenAdvance] = useState(false);
  const [openEditProfile, setOpenEditProfile] = useState(false);
  const [openPayroll, setOpenPayroll] = useState(false);

  // Form state - advance
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [description, setDescription] = useState(`Tạm ứng lương cho ${user.name}`);

  // Form state - profile
  const [baseSalary, setBaseSalary] = useState(user.employeeProfile?.baseSalary?.toString() ?? "0");
  const [bankName, setBankName] = useState(user.employeeProfile?.bankName ?? "");
  const [bankAccount, setBankAccount] = useState(user.employeeProfile?.bankAccount ?? "");

  // Form state - payroll
  const now = new Date();
  const [payrollMonth, setPayrollMonth] = useState(now.getMonth() + 1); // 1-12 (current month)
  const [payrollYear, setPayrollYear] = useState(now.getFullYear());
  const [draft, setDraft] = useState<any | null>(null);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [advanceDeduction, setAdvanceDeduction] = useState("0");
  const [payrollAccountId, setPayrollAccountId] = useState(accounts[0]?.id ?? "");

  function submitAdvance() {
    setError(null);
    const amt = Number(String(amount).replace(/\D/g, ""));
    if (!accountId) return setError("Vui lòng chọn quỹ");
    if (!Number.isFinite(amt) || amt <= 0) return setError("Số tiền phải lớn hơn 0");
    const fd = new FormData();
    fd.set("userId", user.id);
    fd.set("amount", String(amt));
    fd.set("accountId", accountId);
    fd.set("description", description);
    startTransition(async () => {
      const r = await createSalaryAdvanceAction(fd);
      if (r.ok) {
        setOpenAdvance(false);
        setAmount("");
        router.refresh();
      } else {
        setError(r.error);
      }
    });
  }

  function submitEditProfile() {
    setError(null);
    const fd = new FormData();
    fd.set("userId", user.id);
    fd.set("baseSalary", String(Number(String(baseSalary).replace(/\D/g, "")) || 0));
    fd.set("bankName", bankName);
    fd.set("bankAccount", bankAccount);
    startTransition(async () => {
      const r = await updateEmployeeProfileAction(fd);
      if (r.ok) {
        setOpenEditProfile(false);
        router.refresh();
      } else {
        setError(r.error);
      }
    });
  }

  function doApprove(orderId: string) {
    if (!confirm("Duyệt hoa hồng cho đơn hàng này?")) return;
    const fd = new FormData();
    fd.set("orderId", orderId);
    startTransition(async () => {
      const r = await approveCommissionAction(fd);
      if (r.ok) router.refresh();
      else alert(r.error);
    });
  }

  async function loadDraft(month: number, year: number) {
    setError(null);
    setLoadingDraft(true);
    setDraft(null);
    try {
      const d = await getDraftPayslip(user.id, month, year);
      setDraft(d);
      setAdvanceDeduction(d.suggestedNetPay && Number(d.suggestedNetPay) < Number(d.baseSalary)
        ? d.maxDeduction
        : d.maxDeduction); // mặc định cấn trừ = max debt
    } catch (e: any) {
      setError(e?.message || "Không tính được draft");
    } finally {
      setLoadingDraft(false);
    }
  }

  function openPayrollModal() {
    setOpenPayroll(true);
    loadDraft(payrollMonth, payrollYear);
  }

  function submitFinalize() {
    setError(null);
    if (!payrollAccountId) return setError("Vui lòng chọn quỹ thanh toán");
    if (!draft) return setError("Chưa có draft");
    const adv = Number(String(advanceDeduction).replace(/\D/g, "")) || 0;
    const gross = Number(draft.baseSalary) + Number(draft.approvedCommission);
    const netPay = gross - adv;
    if (netPay < 0) return setError("Cấn trừ vượt quá Gross — Thực lãnh âm. Vui lòng giảm cấn trừ.");
    if (!confirm(`Xác nhận chốt lương T${payrollMonth}/${payrollYear} cho ${user.name}\n\nThực lãnh: ${netPay.toLocaleString("vi-VN")} đ\nCấn trừ nợ: ${adv.toLocaleString("vi-VN")} đ`)) return;
    const fd = new FormData();
    fd.set("userId", user.id);
    fd.set("month", String(payrollMonth));
    fd.set("year", String(payrollYear));
    fd.set("baseSalaryAmount", draft.baseSalary);
    fd.set("commissionAmount", draft.approvedCommission);
    fd.set("advanceDeduction", String(adv));
    fd.set("netPay", String(netPay));
    fd.set("accountId", payrollAccountId);
    startTransition(async () => {
      const r = await finalizePayrollAction(fd);
      if (r.ok) {
        setOpenPayroll(false);
        router.refresh();
      } else {
        setError(r.error);
      }
    });
  }

  const totalAdvance = advances.reduce((s, a) => s + (a.type === "ADVANCE" ? Number(a.amount) : -Number(a.amount)), 0);
  const totalCommissionPending = commissions.filter((c) => c.commissionStatus === "PENDING").reduce((s, c) => s + Number(c.commissionAmount), 0);
  const totalCommissionApproved = commissions.filter((c) => c.commissionStatus === "APPROVED").reduce((s, c) => s + Number(c.commissionAmount), 0);

  return (
    <div>
      <div style={{ marginBottom: "var(--space-5)" }}>
        <Link href="/hr/employees" style={{ fontSize: "var(--text-sm)", color: "var(--color-primary)", textDecoration: "none" }}>← Quay lại danh sách</Link>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--space-5)", flexWrap: "wrap", gap: "var(--space-3)" }}>
        <div>
          <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, marginBottom: 4 }}>{user.name}</h1>
          <p style={{ color: "var(--color-foreground-muted)", fontSize: "var(--text-sm)", margin: 0 }}>
            {user.email} {user.role?.name ? ` · ${user.role.name}` : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
          <button onClick={() => setOpenEditProfile(true)} style={{ height: 40, padding: "0 16px", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", fontWeight: 600, cursor: "pointer", border: "1px solid var(--color-border-strong)", background: "var(--color-surface)", color: "var(--color-foreground)" }}>
            ✏️ Sửa hồ sơ
          </button>
          <button onClick={() => setOpenAdvance(true)} style={{ height: 40, padding: "0 16px", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", fontWeight: 700, cursor: "pointer", border: "none", background: "#D97706", color: "white" }}>
            💵 Chi Tạm Ứng
          </button>
          <button onClick={openPayrollModal} style={{ height: 40, padding: "0 16px", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", fontWeight: 700, cursor: "pointer", border: "none", background: "#16A34A", color: "white" }}>
            🧾 Thanh Toán Lương
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--space-4)", marginBottom: "var(--space-6)" }}>
        <StatBox label="Lương cứng" value={user.employeeProfile?.baseSalary ? `${Number(user.employeeProfile.baseSalary).toLocaleString("vi-VN")} đ` : "—"} />
        <StatBox label="Tổng tạm ứng (ròng)" value={`${totalAdvance.toLocaleString("vi-VN")} đ`} color={totalAdvance > 0 ? "#D97706" : "var(--color-success)"} />
        <StatBox label="Hoa hồng chờ duyệt" value={`${totalCommissionPending.toLocaleString("vi-VN")} đ`} color="#1D4ED8" />
        <StatBox label="Hoa hồng đã duyệt" value={`${totalCommissionApproved.toLocaleString("vi-VN")} đ`} color="var(--color-success)" />
      </div>

      {error && (
        <div style={{ padding: "var(--space-2) var(--space-3)", background: "var(--color-destructive-bg)", color: "var(--color-destructive)", borderRadius: "var(--radius-sm)", fontSize: "var(--text-xs)", marginBottom: "var(--space-4)" }}>
          {error}
        </div>
      )}

      {/* Bank info */}
      <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "var(--space-5)", marginBottom: "var(--space-6)" }}>
        <h3 style={{ fontSize: "var(--text-base)", fontWeight: 700, marginBottom: "var(--space-3)" }}>🏦 Thông tin chuyển lương</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)", fontSize: "var(--text-sm)" }}>
          <div><span style={{ color: "var(--color-foreground-muted)" }}>Ngân hàng: </span><strong>{user.employeeProfile?.bankName || "—"}</strong></div>
          <div><span style={{ color: "var(--color-foreground-muted)" }}>Số tài khoản: </span><strong>{user.employeeProfile?.bankAccount || "—"}</strong></div>
        </div>
      </div>

      {/* Advances table */}
      <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", overflow: "hidden", marginBottom: "var(--space-6)" }}>
        <div style={{ padding: "var(--space-4)", borderBottom: "1px solid var(--color-border)" }}>
          <h3 style={{ fontSize: "var(--text-base)", fontWeight: 700, margin: 0 }}>💵 Lịch sử Tạm ứng</h3>
        </div>
        {advances.length === 0 ? (
          <div style={{ padding: "var(--space-6)", textAlign: "center", color: "var(--color-foreground-muted)", fontSize: "var(--text-sm)" }}>Chưa có khoản tạm ứng nào.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)", background: "#F8FAFC", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-foreground-muted)", textTransform: "uppercase" }}>
                <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Ngày</th>
                <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Loại</th>
                <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>Số tiền</th>
                <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {advances.map((a: any, i: number) => (
                <tr key={a.id} style={{ borderBottom: i < advances.length - 1 ? "1px solid var(--color-muted)" : "none" }}>
                  <td style={{ padding: "var(--space-3) var(--space-4)", fontVariantNumeric: "tabular-nums" }}>{new Date(a.createdAt).toLocaleString("vi-VN")}</td>
                  <td style={{ padding: "var(--space-3) var(--space-4)" }}>
                    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: "var(--radius-sm)", fontSize: "var(--text-xs)", background: a.type === "ADVANCE" ? "#FEF3C7" : "#DBEAFE", color: a.type === "ADVANCE" ? "#92400E" : "#1E40AF" }}>
                      {a.type === "ADVANCE" ? "Tạm ứng" : "Hoàn ứng"}
                    </span>
                  </td>
                  <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                    {a.type === "ADVANCE" ? "+" : "-"}{Number(a.amount).toLocaleString("vi-VN")} đ
                  </td>
                  <td style={{ padding: "var(--space-3) var(--space-4)", color: "var(--color-foreground-muted)" }}>{a.description || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Commissions table */}
      <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", overflow: "hidden", marginBottom: "var(--space-6)" }}>
        <div style={{ padding: "var(--space-4)", borderBottom: "1px solid var(--color-border)" }}>
          <h3 style={{ fontSize: "var(--text-base)", fontWeight: 700, margin: 0 }}>🎯 Hoa hồng theo đơn hàng</h3>
        </div>
        {commissions.length === 0 ? (
          <div style={{ padding: "var(--space-6)", textAlign: "center", color: "var(--color-foreground-muted)", fontSize: "var(--text-sm)" }}>Chưa có hoa hồng nào.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)", background: "#F8FAFC", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-foreground-muted)", textTransform: "uppercase" }}>
                <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Đơn hàng</th>
                <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Ngày</th>
                <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>Giá trị đơn</th>
                <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>Hoa hồng</th>
                <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}>Trạng thái</th>
                <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {commissions.map((c: any, i: number) => (
                <tr key={c.id} style={{ borderBottom: i < commissions.length - 1 ? "1px solid var(--color-muted)" : "none" }}>
                  <td style={{ padding: "var(--space-3) var(--space-4)", fontWeight: 500 }}>
                    <Link href={`/orders`} style={{ color: "var(--color-primary)", textDecoration: "none" }}>{c.orderCode}</Link>
                  </td>
                  <td style={{ padding: "var(--space-3) var(--space-4)", fontVariantNumeric: "tabular-nums" }}>{new Date(c.createdAt).toLocaleDateString("vi-VN")}</td>
                  <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{Number(c.totalAmount).toLocaleString("vi-VN")} đ</td>
                  <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600, color: "#1D4ED8" }}>
                    {Number(c.commissionAmount).toLocaleString("vi-VN")} đ
                  </td>
                  <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}>
                    <StatusBadge status={c.commissionStatus} />
                  </td>
                  <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center" }}>
                    {c.commissionStatus === "PENDING" && (
                      <button onClick={() => doApprove(c.id)} disabled={pending} style={{ fontSize: "var(--text-xs)", padding: "4px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-success)", background: "transparent", color: "var(--color-success)", cursor: "pointer", fontWeight: 600 }}>
                        ✓ Duyệt
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Payslips history */}
      <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", overflow: "hidden", marginBottom: "var(--space-6)" }}>
        <div style={{ padding: "var(--space-4)", borderBottom: "1px solid var(--color-border)" }}>
          <h3 style={{ fontSize: "var(--text-base)", fontWeight: 700, margin: 0 }}>🧾 Lịch sử Phiếu Lương</h3>
        </div>
        {payslips.length === 0 ? (
          <div style={{ padding: "var(--space-6)", textAlign: "center", color: "var(--color-foreground-muted)", fontSize: "var(--text-sm)" }}>Chưa có phiếu lương nào.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)", background: "#F8FAFC", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-foreground-muted)", textTransform: "uppercase" }}>
                <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Kỳ</th>
                <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>Lương cứng</th>
                <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>Hoa hồng</th>
                <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>Cấn trừ nợ</th>
                <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>Thực lãnh</th>
                <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Ngày chốt</th>
              </tr>
            </thead>
            <tbody>
              {payslips.map((p: any, i: number) => (
                <tr key={p.id} style={{ borderBottom: i < payslips.length - 1 ? "1px solid var(--color-muted)" : "none" }}>
                  <td style={{ padding: "var(--space-3) var(--space-4)", fontWeight: 600 }}>T{p.month}/{p.year}</td>
                  <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{Number(p.baseSalaryAmount).toLocaleString("vi-VN")} đ</td>
                  <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#1D4ED8" }}>{Number(p.commissionAmount).toLocaleString("vi-VN")} đ</td>
                  <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#D97706" }}>
                    {Number(p.advanceDeduction) > 0 ? `- ${Number(p.advanceDeduction).toLocaleString("vi-VN")} đ` : "—"}
                  </td>
                  <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700, color: "var(--color-success)" }}>{Number(p.netPay).toLocaleString("vi-VN")} đ</td>
                  <td style={{ padding: "var(--space-3) var(--space-4)", fontVariantNumeric: "tabular-nums", fontSize: "var(--text-xs)" }}>{new Date(p.createdAt).toLocaleString("vi-VN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal: Chi Tạm Ứng */}
      {openAdvance && (
        <div style={modalOverlay} onClick={() => setOpenAdvance(false)}>
          <div style={{ background: "white", padding: 24, borderRadius: 8, width: 460, maxWidth: "92vw" }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: "var(--text-base)", fontWeight: 700, marginBottom: "var(--space-4)" }}>
              💵 Chi Tạm Ứng — {user.name}
            </h3>
            {error && <div style={{ padding: "var(--space-2) var(--space-3)", background: "var(--color-destructive-bg)", color: "var(--color-destructive)", borderRadius: "var(--radius-sm)", fontSize: "var(--text-xs)", marginBottom: "var(--space-3)" }}>{error}</div>}
            <div style={{ display: "grid", gap: "var(--space-3)" }}>
              <div>
                <label style={{ fontSize: "var(--text-xs)", fontWeight: 600, display: "block", marginBottom: 2 }}>Quỹ xuất tiền *</label>
                <select value={accountId} onChange={(e) => setAccountId(e.target.value)} style={{ width: "100%", height: 40, padding: "0 10px", border: "1px solid var(--color-border-strong)", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", background: "var(--color-surface)" }}>
                  <option value="">-- Chọn quỹ --</option>
                  {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.name} ({Number(a.balance).toLocaleString("vi-VN")} đ)</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: "var(--text-xs)", fontWeight: 600, display: "block", marginBottom: 2 }}>Số tiền (VND) *</label>
                <input type="text" inputMode="numeric" value={amount ? Number(amount).toLocaleString("vi-VN") : ""} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} placeholder="VD: 3,000,000" style={{ width: "100%", height: 40, padding: "0 10px", border: "1px solid var(--color-border-strong)", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", background: "var(--color-surface)" }} />
              </div>
              <div>
                <label style={{ fontSize: "var(--text-xs)", fontWeight: 600, display: "block", marginBottom: 2 }}>Ghi chú</label>
                <input value={description} onChange={(e) => setDescription(e.target.value)} style={{ width: "100%", height: 40, padding: "0 10px", border: "1px solid var(--color-border-strong)", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", background: "var(--color-surface)" }} />
              </div>
              <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-2)" }}>
                <button onClick={submitAdvance} disabled={pending} style={{ height: 40, padding: "0 16px", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", fontWeight: 700, cursor: "pointer", border: "none", background: "#D97706", color: "white" }}>
                  {pending ? "Đang xử lý..." : "Xác nhận Chi"}
                </button>
                <button onClick={() => setOpenAdvance(false)} style={{ height: 40, padding: "0 16px", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", fontWeight: 600, cursor: "pointer", border: "1px solid var(--color-border-strong)", background: "var(--color-surface)", color: "var(--color-foreground)" }}>
                  Hủy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Profile */}
      {openEditProfile && (
        <div style={modalOverlay} onClick={() => setOpenEditProfile(false)}>
          <div style={{ background: "white", padding: 24, borderRadius: 8, width: 460, maxWidth: "92vw" }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: "var(--text-base)", fontWeight: 700, marginBottom: "var(--space-4)" }}>
              ✏️ Sửa Hồ sơ — {user.name}
            </h3>
            {error && <div style={{ padding: "var(--space-2) var(--space-3)", background: "var(--color-destructive-bg)", color: "var(--color-destructive)", borderRadius: "var(--radius-sm)", fontSize: "var(--text-xs)", marginBottom: "var(--space-3)" }}>{error}</div>}
            <div style={{ display: "grid", gap: "var(--space-3)" }}>
              <div>
                <label style={{ fontSize: "var(--text-xs)", fontWeight: 600, display: "block", marginBottom: 2 }}>Lương cứng (VND)</label>
                <input type="text" inputMode="numeric" value={Number(String(baseSalary).replace(/\D/g, "") || 0).toLocaleString("vi-VN")} onChange={(e) => setBaseSalary(e.target.value.replace(/\D/g, ""))} placeholder="0" style={{ width: "100%", height: 40, padding: "0 10px", border: "1px solid var(--color-border-strong)", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", background: "var(--color-surface)" }} />
              </div>
              <div>
                <label style={{ fontSize: "var(--text-xs)", fontWeight: 600, display: "block", marginBottom: 2 }}>Ngân hàng</label>
                <input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="VD: Vietcombank" style={{ width: "100%", height: 40, padding: "0 10px", border: "1px solid var(--color-border-strong)", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", background: "var(--color-surface)" }} />
              </div>
              <div>
                <label style={{ fontSize: "var(--text-xs)", fontWeight: 600, display: "block", marginBottom: 2 }}>Số tài khoản</label>
                <input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} placeholder="VD: 0123 4567 8901" style={{ width: "100%", height: 40, padding: "0 10px", border: "1px solid var(--color-border-strong)", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", background: "var(--color-surface)" }} />
              </div>
              <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-2)" }}>
                <button onClick={submitEditProfile} disabled={pending} style={{ height: 40, padding: "0 16px", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", fontWeight: 700, cursor: "pointer", border: "none", background: "var(--color-primary)", color: "white" }}>
                  {pending ? "Đang lưu..." : "Lưu hồ sơ"}
                </button>
                <button onClick={() => setOpenEditProfile(false)} style={{ height: 40, padding: "0 16px", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", fontWeight: 600, cursor: "pointer", border: "1px solid var(--color-border-strong)", background: "var(--color-surface)", color: "var(--color-foreground)" }}>
                  Hủy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Thanh Toán Lương (MSEW-payroll-hr-phase2) */}
      {openPayroll && (
        <div style={modalOverlay} onClick={() => setOpenPayroll(false)}>
          <div style={{ background: "white", padding: 24, borderRadius: 8, width: 560, maxWidth: "92vw" }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: "var(--text-base)", fontWeight: 700, marginBottom: "var(--space-4)" }}>
              🧾 Thanh Toán Lương — {user.name}
            </h3>
            {error && <div style={{ padding: "var(--space-2) var(--space-3)", background: "var(--color-destructive-bg)", color: "var(--color-destructive)", borderRadius: "var(--radius-sm)", fontSize: "var(--text-xs)", marginBottom: "var(--space-3)" }}>{error}</div>}
            <div style={{ display: "grid", gap: "var(--space-3)" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                <div>
                  <label style={{ fontSize: "var(--text-xs)", fontWeight: 600, display: "block", marginBottom: 2 }}>Tháng *</label>
                  <select value={payrollMonth} onChange={(e) => { const m = Number(e.target.value); setPayrollMonth(m); loadDraft(m, payrollYear); }} style={{ width: "100%", height: 40, padding: "0 10px", border: "1px solid var(--color-border-strong)", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", background: "var(--color-surface)" }}>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>Tháng {m}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "var(--text-xs)", fontWeight: 600, display: "block", marginBottom: 2 }}>Năm *</label>
                  <select value={payrollYear} onChange={(e) => { const y = Number(e.target.value); setPayrollYear(y); loadDraft(payrollMonth, y); }} style={{ width: "100%", height: 40, padding: "0 10px", border: "1px solid var(--color-border-strong)", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", background: "var(--color-surface)" }}>
                    {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>

              {loadingDraft && (
                <div style={{ padding: "var(--space-4)", textAlign: "center", color: "var(--color-foreground-muted)", fontSize: "var(--text-sm)" }}>
                  Đang tính toán draft...
                </div>
              )}

              {draft && !loadingDraft && (
                <>
                  <div style={{ background: "#F8FAFC", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "var(--space-3)" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "var(--space-2)", fontSize: "var(--text-sm)" }}>
                      <span style={{ color: "var(--color-foreground-muted)" }}>Lương cứng</span>
                      <strong style={{ fontVariantNumeric: "tabular-nums" }}>{Number(draft.baseSalary).toLocaleString("vi-VN")} đ</strong>
                      <span style={{ color: "var(--color-foreground-muted)" }}>Hoa hồng đã duyệt</span>
                      <strong style={{ fontVariantNumeric: "tabular-nums", color: "#1D4ED8" }}>+ {Number(draft.approvedCommission).toLocaleString("vi-VN")} đ</strong>
                      <span style={{ color: "var(--color-foreground-muted)", borderTop: "1px solid var(--color-border)", paddingTop: "var(--space-2)" }}>Tổng Gross</span>
                      <strong style={{ fontVariantNumeric: "tabular-nums", borderTop: "1px solid var(--color-border)", paddingTop: "var(--space-2)" }}>{Number(draft.grossPay).toLocaleString("vi-VN")} đ</strong>
                      <span style={{ color: "var(--color-foreground-muted)" }}>Dư nợ tạm ứng</span>
                      <strong style={{ fontVariantNumeric: "tabular-nums", color: Number(draft.currentDebt) > 0 ? "#D97706" : "var(--color-success)" }}>{Number(draft.currentDebt).toLocaleString("vi-VN")} đ</strong>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: "var(--text-xs)", fontWeight: 600, display: "block", marginBottom: 2 }}>Số tiền cấn trừ nợ (VND)</label>
                    <input type="text" inputMode="numeric" value={Number(String(advanceDeduction).replace(/\D/g, "") || 0).toLocaleString("vi-VN")} onChange={(e) => setAdvanceDeduction(e.target.value.replace(/\D/g, ""))} placeholder="0" style={{ width: "100%", height: 40, padding: "0 10px", border: "1px solid var(--color-border-strong)", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", background: "var(--color-surface)" }} />
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--color-foreground-muted)", marginTop: 2 }}>Mặc định cấn trừ tối đa = min(Dư nợ, Gross). Có thể giảm để cho nợ tiếp tháng sau.</div>
                  </div>

                  <div style={{ background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: "var(--radius-md)", padding: "var(--space-3)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 600, color: "#065F46" }}>Thực lãnh = Gross - Cấn trừ</span>
                    <strong style={{ fontVariantNumeric: "tabular-nums", fontSize: "var(--text-lg)", color: "#065F46" }}>
                      {(Number(draft.grossPay) - (Number(String(advanceDeduction).replace(/\D/g, "")) || 0)).toLocaleString("vi-VN")} đ
                    </strong>
                  </div>

                  <div>
                    <label style={{ fontSize: "var(--text-xs)", fontWeight: 600, display: "block", marginBottom: 2 }}>Quỹ thanh toán *</label>
                    <select value={payrollAccountId} onChange={(e) => setPayrollAccountId(e.target.value)} style={{ width: "100%", height: 40, padding: "0 10px", border: "1px solid var(--color-border-strong)", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", background: "var(--color-surface)" }}>
                      <option value="">-- Chọn quỹ --</option>
                      {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.name} ({Number(a.balance).toLocaleString("vi-VN")} đ)</option>)}
                    </select>
                  </div>
                </>
              )}

              <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-2)" }}>
                <button onClick={submitFinalize} disabled={pending || !draft} style={{ height: 40, padding: "0 16px", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", fontWeight: 700, cursor: pending || !draft ? "not-allowed" : "pointer", border: "none", background: "#16A34A", color: "white", opacity: pending || !draft ? 0.6 : 1 }}>
                  {pending ? "Đang chốt..." : "Xác nhận Chốt lương"}
                </button>
                <button onClick={() => setOpenPayroll(false)} style={{ height: 40, padding: "0 16px", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", fontWeight: 600, cursor: "pointer", border: "1px solid var(--color-border-strong)", background: "var(--color-surface)", color: "var(--color-foreground)" }}>
                  Hủy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "var(--space-4)" }}>
      <div style={{ fontSize: "var(--text-xs)", color: "var(--color-foreground-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: color || "var(--color-foreground)", fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; fg: string }> = {
    PENDING: { label: "Chờ duyệt", bg: "#FEF3C7", fg: "#92400E" },
    APPROVED: { label: "Đã duyệt", bg: "#DBEAFE", fg: "#1E40AF" },
    PAID: { label: "Đã thanh toán", bg: "#D1FAE5", fg: "#065F46" },
  };
  const v = map[status] ?? { label: status, bg: "#E5E7EB", fg: "#374151" };
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: "var(--radius-sm)", fontSize: "var(--text-xs)", background: v.bg, color: v.fg, fontWeight: 600 }}>
      {v.label}
    </span>
  );
}
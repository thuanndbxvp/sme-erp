"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSalaryAdvanceAction } from "@/app/actions/hr-actions";

/* eslint-disable @typescript-eslint/no-explicit-any */

const pageSize = 20;

export default function HrEmployeesClient({ users, accounts }: { users: any[]; accounts: any[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [advanceUser, setAdvanceUser] = useState<any | null>(null);
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [advanceAccountId, setAdvanceAccountId] = useState(accounts[0]?.id ?? "");
  const [advanceDesc, setAdvanceDesc] = useState("");
  const [advanceError, setAdvanceError] = useState<string | null>(null);

  const filtered = users.filter((u: any) =>
    !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const display = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function openAdvance(u: any) {
    setAdvanceUser(u);
    setAdvanceAmount("");
    setAdvanceDesc(`Tạm ứng lương cho ${u.name}`);
    setAdvanceError(null);
  }

  function submitAdvance() {
    setAdvanceError(null);
    const amt = Number(String(advanceAmount).replace(/\D/g, ""));
    if (!advanceAccountId) {
      setAdvanceError("Vui lòng chọn quỹ");
      return;
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      setAdvanceError("Số tiền phải lớn hơn 0");
      return;
    }
    const fd = new FormData();
    fd.set("userId", advanceUser.id);
    fd.set("amount", String(amt));
    fd.set("accountId", advanceAccountId);
    fd.set("description", advanceDesc);
    startTransition(async () => {
      const r = await createSalaryAdvanceAction(fd);
      if (r.ok) {
        setAdvanceUser(null);
        router.refresh();
      } else {
        setAdvanceError(r.error);
      }
    });
  }

  return (
    <div>
      <div style={{ display: "flex", gap: "var(--space-3)", marginBottom: "var(--space-5)" }}>
        <input
          placeholder="🔍 Tìm theo tên hoặc email..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
          style={{ flex: 1, height: 40, padding: "0 12px", border: "1px solid var(--color-border-strong)", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", background: "var(--color-surface)" }}
        />
      </div>

      <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--color-border)", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-foreground-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Nhân viên</th>
              <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Email</th>
              <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Vai trò</th>
              <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>Lương cứng</th>
              <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center", width: 220 }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {display.length === 0 && (
              <tr><td colSpan={5} style={{ padding: "var(--space-6)", textAlign: "center", color: "var(--color-foreground-muted)" }}>Không có nhân viên.</td></tr>
            )}
            {display.map((u: any, i: number) => (
              <tr key={u.id} style={{ borderBottom: i < display.length - 1 ? "1px solid var(--color-muted)" : "none", background: i % 2 === 0 ? "var(--color-surface)" : "var(--color-surface-hover)" }}>
                <td style={{ padding: "var(--space-3) var(--space-4)", fontWeight: 500 }}>
                  <Link href={`/hr/employees/${u.id}`} style={{ color: "var(--color-primary)", textDecoration: "none" }}>
                    {u.name}
                  </Link>
                </td>
                <td style={{ padding: "var(--space-3) var(--space-4)", fontSize: "var(--text-xs)" }}>{u.email}</td>
                <td style={{ padding: "var(--space-3) var(--space-4)" }}>{u.role?.name ?? "—"}</td>
                <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  {u.employeeProfile?.baseSalary
                    ? `${Number(u.employeeProfile.baseSalary).toLocaleString("vi-VN")} đ`
                    : <span style={{ color: "var(--color-foreground-muted)" }}>—</span>}
                </td>
                <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "center", whiteSpace: "nowrap" }}>
                  <button onClick={() => openAdvance(u)} disabled={pending} style={{ fontSize: "var(--text-xs)", padding: "4px 10px", borderRadius: "var(--radius-sm)", border: "1px solid #D97706", background: "transparent", color: "#D97706", cursor: "pointer", fontWeight: 600 }}>
                    💵 Chi Tạm Ứng
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "var(--space-2)", padding: "var(--space-3)", borderTop: "1px solid var(--color-border)" }}>
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} style={{ padding: "var(--space-1) var(--space-3)", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)", background: "var(--color-surface)", cursor: currentPage === 1 ? "not-allowed" : "pointer", opacity: currentPage === 1 ? 0.5 : 1 }}>‹</button>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--color-foreground-muted)" }}>Trang {currentPage} / {totalPages}</span>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} style={{ padding: "var(--space-1) var(--space-3)", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)", background: "var(--color-surface)", cursor: currentPage === totalPages ? "not-allowed" : "pointer", opacity: currentPage === totalPages ? 0.5 : 1 }}>›</button>
          </div>
        )}
      </div>

      {/* Modal: Chi Tạm Ứng */}
      {advanceUser && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }} onClick={() => setAdvanceUser(null)}>
          <div style={{ background: "white", padding: 24, borderRadius: 8, width: 460, maxWidth: "92vw" }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: "var(--text-base)", fontWeight: 700, marginBottom: "var(--space-4)" }}>
              💵 Chi Tạm Ứng — {advanceUser.name}
            </h3>
            {advanceError && (
              <div style={{ padding: "var(--space-2) var(--space-3)", background: "var(--color-destructive-bg)", color: "var(--color-destructive)", borderRadius: "var(--radius-sm)", fontSize: "var(--text-xs)", marginBottom: "var(--space-3)" }}>
                {advanceError}
              </div>
            )}
            <div style={{ display: "grid", gap: "var(--space-3)" }}>
              <div>
                <label style={{ fontSize: "var(--text-xs)", fontWeight: 600, display: "block", marginBottom: 2 }}>Quỹ xuất tiền *</label>
                <select
                  value={advanceAccountId}
                  onChange={(e) => setAdvanceAccountId(e.target.value)}
                  style={{ width: "100%", height: 40, padding: "0 10px", border: "1px solid var(--color-border-strong)", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", background: "var(--color-surface)" }}
                >
                  <option value="">-- Chọn quỹ --</option>
                  {accounts.map((a: any) => (
                    <option key={a.id} value={a.id}>{a.name} ({Number(a.balance).toLocaleString("vi-VN")} đ)</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: "var(--text-xs)", fontWeight: 600, display: "block", marginBottom: 2 }}>Số tiền (VND) *</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={advanceAmount ? Number(advanceAmount).toLocaleString("vi-VN") : ""}
                  onChange={(e) => setAdvanceAmount(e.target.value.replace(/\D/g, ""))}
                  placeholder="VD: 3,000,000"
                  style={{ width: "100%", height: 40, padding: "0 10px", border: "1px solid var(--color-border-strong)", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", background: "var(--color-surface)" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "var(--text-xs)", fontWeight: 600, display: "block", marginBottom: 2 }}>Ghi chú</label>
                <input
                  value={advanceDesc}
                  onChange={(e) => setAdvanceDesc(e.target.value)}
                  style={{ width: "100%", height: 40, padding: "0 10px", border: "1px solid var(--color-border-strong)", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", background: "var(--color-surface)" }}
                />
              </div>
              <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-2)" }}>
                <button onClick={submitAdvance} disabled={pending} style={{ height: 40, padding: "0 16px", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", fontWeight: 700, cursor: "pointer", border: "none", background: "#D97706", color: "white" }}>
                  {pending ? "Đang xử lý..." : "Xác nhận Chi"}
                </button>
                <button onClick={() => setAdvanceUser(null)} style={{ height: 40, padding: "0 16px", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", fontWeight: 600, cursor: "pointer", border: "1px solid var(--color-border-strong)", background: "var(--color-surface)", color: "var(--color-foreground)" }}>
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
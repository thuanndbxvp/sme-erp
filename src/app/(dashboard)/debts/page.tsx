import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { requirePagePermission } from "@/lib/authorize";
import AgingView from "@/components/debts/AgingView";
import PaymentForm from "@/components/debts/PaymentForm";

export const dynamic = "force-dynamic";

type BucketKey = "current" | "d1_30" | "d31_60" | "d61_90" | "over90";

function calcAging(invoices: Array<{
  id: string; balanceDue: { toString(): string }; createdAt: Date;
  customer?: { id: string; name: string } | null;
  supplier?: { id: string; name: string } | null;
}>, type: "AR" | "AP") {
  const now = new Date();
  const map = new Map<string, {
    partyId: string; partyName: string; totalDue: number;
    current: number; d1_30: number; d31_60: number; d61_90: number; over90: number; invoiceCount: number;
  }>();

  for (const inv of invoices) {
    const partyId = type === "AR" ? inv.customer?.id : inv.supplier?.id;
    if (!partyId) continue;
    const partyName = type === "AR" ? inv.customer?.name ?? "N/A" : inv.supplier?.name ?? "N/A";
    const bal = Number(inv.balanceDue);
    if (bal <= 0) continue;

    // Due date = createdAt + 30 days (typical SME term)
    const dueDate = new Date(inv.createdAt);
    dueDate.setDate(dueDate.getDate() + 30);
    const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / 86400000);

    let bucket: BucketKey;
    if (daysOverdue <= 0) bucket = "current";
    else if (daysOverdue <= 30) bucket = "d1_30";
    else if (daysOverdue <= 60) bucket = "d31_60";
    else if (daysOverdue <= 90) bucket = "d61_90";
    else bucket = "over90";

    if (!map.has(partyId)) {
      map.set(partyId, { partyId, partyName, totalDue: 0, current: 0, d1_30: 0, d31_60: 0, d61_90: 0, over90: 0, invoiceCount: 0 });
    }
    const entry = map.get(partyId)!;
    entry.totalDue += bal;
    entry[bucket] += bal;
    entry.invoiceCount += 1;
  }

  return Array.from(map.values()).sort((a, b) => b.totalDue - a.totalDue);
}

export default async function DebtsPage() {
  const session = await auth();
  await requirePagePermission(session?.user?.id, "debt.view");
  const [accounts, arInvoicesRaw, apInvoicesRaw] = await Promise.all([
    prisma.account.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
    prisma.invoice.findMany({ where: { type: "AR", status: { not: "CANCELLED" }, balanceDue: { gt: "0" } }, include: { customer: { select: { id: true, name: true } }, salesOrder: { select: { orderCode: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.invoice.findMany({ where: { type: "AP", status: { not: "CANCELLED" }, balanceDue: { gt: "0" } }, include: { supplier: { select: { id: true, name: true } }, purchaseOrder: { select: { orderCode: true } } }, orderBy: { createdAt: "desc" } }),
  ]);

  const arData = calcAging(arInvoicesRaw, "AR");
  const apData = calcAging(apInvoicesRaw, "AP");

  const totalAR = arData.reduce((s, r) => s + r.totalDue, 0);
  const totalAP = apData.reduce((s, r) => s + r.totalDue, 0);
  const overdueAR = arData.reduce((s, r) => s + r.d1_30 + r.d31_60 + r.d61_90 + r.over90, 0);
  const overdueAP = apData.reduce((s, r) => s + r.d1_30 + r.d31_60 + r.d61_90 + r.over90, 0);
  const arCount = arInvoicesRaw.length;
  const apCount = apInvoicesRaw.length;

  return (
    <div>
      <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, marginBottom: "var(--space-1)" }}>Công nợ & Tuổi nợ</h1>
      <p style={{ fontSize: "var(--text-sm)", color: "var(--color-foreground-muted)", marginBottom: "var(--space-6)" }}>
        Phải thu: {totalAR.toLocaleString("vi-VN")} đ (quá hạn: {overdueAR.toLocaleString("vi-VN")} đ) · Phải trả: {totalAP.toLocaleString("vi-VN")} đ (quá hạn: {overdueAP.toLocaleString("vi-VN")} đ)
      </p>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)", marginBottom: "var(--space-6)" }}>
        <div style={{ background: "var(--color-success-bg)", border: "1px solid var(--color-success)", borderRadius: "var(--radius-lg)", padding: "var(--space-5)" }}>
          <div style={{ fontWeight: 600, color: "var(--color-success)", fontSize: "var(--text-base)" }}>Phải thu khách hàng</div>
          <div style={{ fontSize: "var(--text-2xl)", fontWeight: 700, marginTop: "var(--space-2)" }}>{totalAR.toLocaleString("vi-VN")} đ</div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--color-foreground-muted)", marginTop: "var(--space-1)" }}>{arCount} hóa đơn · {arData.length} khách hàng · Quá hạn: {overdueAR.toLocaleString("vi-VN")} đ</div>
        </div>
        <div style={{ background: "var(--color-warning-bg)", border: "1px solid var(--color-warning)", borderRadius: "var(--radius-lg)", padding: "var(--space-5)" }}>
          <div style={{ fontWeight: 600, color: "var(--color-warning)", fontSize: "var(--text-base)" }}>Phải trả nhà cung cấp</div>
          <div style={{ fontSize: "var(--text-2xl)", fontWeight: 700, marginTop: "var(--space-2)" }}>{totalAP.toLocaleString("vi-VN")} đ</div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--color-foreground-muted)", marginTop: "var(--space-1)" }}>{apCount} hóa đơn · {apData.length} nhà cung cấp · Quá hạn: {overdueAP.toLocaleString("vi-VN")} đ</div>
        </div>
      </div>

      {/* Aging View */}
      <AgingView arData={arData} apData={apData} />

      {/* Payment Recording */}
      <PaymentForm
        accounts={JSON.parse(JSON.stringify(accounts))}
        arInvoices={JSON.parse(JSON.stringify(arInvoicesRaw))}
        apInvoices={JSON.parse(JSON.stringify(apInvoicesRaw))}
      />
    </div>
  );
}

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/authorize";
import HrEmployeeDetailClient from "./HrEmployeeDetailClient";

export const dynamic = "force-dynamic";

export default async function HrEmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  await requirePermission(session?.user?.id, "hr.view");

  const { id } = await params;

  const [user, advances, commissions, accounts, payslips] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      include: { role: true, employeeProfile: true },
    }),
    prisma.employeeTransaction.findMany({
      where: { userId: id, type: { in: ["ADVANCE", "REFUND"] } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.salesOrder.findMany({
      where: {
        salespersonId: id,
        commissionAmount: { gt: 0 },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        orderCode: true,
        commissionAmount: true,
        commissionStatus: true,
        createdAt: true,
        totalAmount: true,
      },
    }),
    prisma.account.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.payslip.findMany({
      where: { userId: id },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      take: 24,
    }),
  ]);

  if (!user) {
    return (
      <div>
        <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700 }}>Không tìm thấy nhân viên</h1>
      </div>
    );
  }

  return (
    <HrEmployeeDetailClient
      user={JSON.parse(JSON.stringify(user))}
      advances={JSON.parse(JSON.stringify(advances))}
      commissions={JSON.parse(JSON.stringify(commissions))}
      accounts={JSON.parse(JSON.stringify(accounts))}
      payslips={JSON.parse(JSON.stringify(payslips))}
    />
  );
}
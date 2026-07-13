import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/authorize";
import HrEmployeesClient from "./HrEmployeesClient";

export const dynamic = "force-dynamic";

export default async function HrEmployeesPage() {
  const session = await auth();
  await requirePermission(session?.user?.id, "hr.view");

  const [users, accounts] = await Promise.all([
    prisma.user.findMany({
      orderBy: { name: "asc" },
      where: { isActive: true },
      include: { role: true, employeeProfile: true },
    }),
    prisma.account.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div>
      <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, marginBottom: "var(--space-2)" }}>Hồ sơ Nhân sự</h1>
      <p style={{ color: "var(--color-foreground-muted)", fontSize: "var(--text-sm)", marginBottom: "var(--space-6)" }}>
        Quản lý lương cứng, tạm ứng và hoa hồng của nhân viên.
      </p>
      <HrEmployeesClient
        users={JSON.parse(JSON.stringify(users))}
        accounts={JSON.parse(JSON.stringify(accounts))}
      />
    </div>
  );
}
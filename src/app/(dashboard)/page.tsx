import { auth } from "@/lib/auth";
import { DashboardService } from "@/services/dashboard.service";
import { prisma } from "@/lib/prisma";
import DashboardClient from "./DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  const stats = await DashboardService.getExecutiveStats();

  // Chạy tuần tự để tránh quá tải connection pool của Neon serverless khi cold start
  const plMonth = await DashboardService.getProfitAndLoss("month");
  const plQuarter = await DashboardService.getProfitAndLoss("quarter");
  const plYear = await DashboardService.getProfitAndLoss("year");
  const lowStock = await prisma.warehouseInventory.findMany({
    where: { quantity: { lt: 10 } },
    orderBy: { quantity: "asc" },
    take: 5,
    include: { product: true },
  });

  // Role + 3 widget data
  let userRole = "GUEST";
  if (session?.user?.id) {
    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: { select: { name: true } } },
    });
    if (dbUser?.role?.name) userRole = dbUser.role.name;
  }
  const isAdminOrAccountant = ["ADMIN", "ACCOUNTANT"].includes(userRole);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let topAR: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let topAP: any[] = [];
  if (isAdminOrAccountant) {
    topAR = await prisma.invoice.findMany({
      where: { type: "AR", status: { in: ["OPEN", "PARTIAL"] } },
      orderBy: { balanceDue: "desc" },
      take: 5,
      include: { customer: true },
    });
    topAP = await prisma.invoice.findMany({
      where: { type: "AP", status: { in: ["OPEN", "PARTIAL"] } },
      orderBy: { balanceDue: "desc" },
      take: 5,
      include: { supplier: true },
    });
  }

  return (
    <DashboardClient
      stats={stats}
      userRole={userRole}
      isAdminOrAccountant={isAdminOrAccountant}
      plMonth={plMonth}
      plQuarter={plQuarter}
      plYear={plYear}
      topAR={JSON.parse(JSON.stringify(topAR))}
      topAP={JSON.parse(JSON.stringify(topAP))}
      lowStock={JSON.parse(JSON.stringify(lowStock))}
    />
  );
}
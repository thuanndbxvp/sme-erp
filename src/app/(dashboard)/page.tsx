import { auth } from "@/lib/auth";
import { DashboardService } from "@/services/dashboard.service";
import { prisma } from "@/lib/prisma";
import DashboardClient from "./DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  const stats = await DashboardService.getExecutiveStats();

  // Fetch all 3 periods 1 lần để Tab switch instant (server component).
  const [plMonth, plQuarter, plYear, lowStock] = await Promise.all([
    DashboardService.getProfitAndLoss("month"),
    DashboardService.getProfitAndLoss("quarter"),
    DashboardService.getProfitAndLoss("year"),
    prisma.warehouseInventory.findMany({
      where: { quantity: { lt: 10 } },
      orderBy: { quantity: "asc" },
      take: 5,
      include: { product: true },
    }),
  ]);

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

  const [topAR, topAP] = isAdminOrAccountant
    ? await Promise.all([
        prisma.invoice.findMany({
          where: { type: "AR", status: { in: ["OPEN", "PARTIAL"] } },
          orderBy: { balanceDue: "desc" },
          take: 5,
          include: { customer: true },
        }),
        prisma.invoice.findMany({
          where: { type: "AP", status: { in: ["OPEN", "PARTIAL"] } },
          orderBy: { balanceDue: "desc" },
          take: 5,
          include: { supplier: true },
        }),
      ])
    : [[], []];

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
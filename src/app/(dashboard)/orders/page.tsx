import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { requirePagePermission } from "@/lib/authorize";
import OrderTabsClient from "./OrderTabsClient";

export const dynamic = "force-dynamic";

export type SalesOrderRow = {
  id: string; orderCode: string; status: string; paymentStatus: string;
  fulfillmentType: string; totalAmount: string; saleDate: string | null;
  customer: { name: string } | null;
  items: Array<{ productName: string; qty: number }>;
};
export type PurchaseOrderRow = {
  id: string; orderCode: string; status: string; paymentStatus: string;
  totalAmount: string; orderDate: string | null;
  supplier: { name: string } | null;
  items: Array<{ productName: string; qty: number }>;
};

type PageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function OrdersPage(props: PageProps) {
  const session = await auth();
  await requirePagePermission(session?.user?.id, "order.view");
  const params = await props.searchParams;
  const tab = params.tab === "PO" ? "PO" : "SO";
  const page = parseInt((params.page as string) || "1", 10);
  const pageSize = 15;
  const skip = (page - 1) * pageSize;
  const period = params.period || "all";
  const from = params.from || "";
  const to = params.to || "";

  let dateFilter: Record<string, Date> | undefined = undefined;
  const now = new Date();
  
  if (period === "today") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    dateFilter = { gte: start };
  } else if (period === "week") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
    dateFilter = { gte: start };
  } else if (period === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    dateFilter = { gte: start };
  } else if (period === "custom" && from && to) {
    dateFilter = { gte: new Date(from as string), lte: new Date(to as string) };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let salesOrders: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let purchaseOrders: any[] = [];
  let totalCount = 0;

  if (tab === "SO") {
    totalCount = await prisma.salesOrder.count({ where: dateFilter ? { createdAt: dateFilter } : undefined });
    salesOrders = await prisma.salesOrder.findMany({
      where: dateFilter ? { createdAt: dateFilter } : undefined,
      orderBy: { createdAt: "desc" }, skip, take: pageSize,
      include: { customer: { select: { name: true } }, items: { select: { productName: true, qty: true } } },
    });
  } else {
    totalCount = await prisma.purchaseOrder.count({ where: dateFilter ? { createdAt: dateFilter } : undefined });
    purchaseOrders = await prisma.purchaseOrder.findMany({
      where: dateFilter ? { createdAt: dateFilter } : undefined,
      orderBy: { createdAt: "desc" }, skip, take: pageSize,
      include: { supplier: { select: { name: true } }, items: { select: { productName: true, qty: true } } },
    });
  }

  const soCount = tab === "SO" ? totalCount : await prisma.salesOrder.count({ where: dateFilter ? { createdAt: dateFilter } : undefined });
  const poCount = tab === "PO" ? totalCount : await prisma.purchaseOrder.count({ where: dateFilter ? { createdAt: dateFilter } : undefined });

  return (
    <div>
      <div style={{ marginBottom: "var(--space-6)" }}>
        <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, margin: 0 }}>Đơn hàng</h1>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--color-foreground-muted)", marginTop: "var(--space-1)" }}>
          {soCount} đơn bán · {poCount} đơn mua
        </p>
      </div>
      <OrderTabs
        salesOrders={JSON.parse(JSON.stringify(salesOrders)) as SalesOrderRow[]}
        purchaseOrders={JSON.parse(JSON.stringify(purchaseOrders)) as PurchaseOrderRow[]}
        initialTab={tab}
        currentPage={page}
        totalPages={Math.ceil(totalCount / pageSize)}
        soCount={soCount}
        poCount={poCount}
        currentPeriod={period as string}
        currentFrom={from as string}
        currentTo={to as string}
      />
    </div>
  );
}

function OrderTabs(props: {
  salesOrders: SalesOrderRow[]; purchaseOrders: PurchaseOrderRow[];
  initialTab: "SO" | "PO"; currentPage: number; totalPages: number;
  soCount: number; poCount: number;
  currentPeriod: string; currentFrom: string; currentTo: string;
}) {
  return <OrderTabsClient {...props} />;
}

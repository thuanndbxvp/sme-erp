import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/authorize";
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
  await requirePermission(session?.user?.id, "order.view");
  const params = await props.searchParams;
  const tab = params.tab === "PO" ? "PO" : "SO";
  const page = parseInt((params.page as string) || "1", 10);
  const pageSize = 15;
  const skip = (page - 1) * pageSize;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let salesOrders: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let purchaseOrders: any[] = [];
  let totalCount = 0;

  if (tab === "SO") {
    totalCount = await prisma.salesOrder.count();
    salesOrders = await prisma.salesOrder.findMany({
      orderBy: { createdAt: "desc" }, skip, take: pageSize,
      include: { customer: { select: { name: true } }, items: { select: { productName: true, qty: true } } },
    });
  } else {
    totalCount = await prisma.purchaseOrder.count();
    purchaseOrders = await prisma.purchaseOrder.findMany({
      orderBy: { createdAt: "desc" }, skip, take: pageSize,
      include: { supplier: { select: { name: true } }, items: { select: { productName: true, qty: true } } },
    });
  }

  const soCount = tab === "SO" ? totalCount : await prisma.salesOrder.count();
  const poCount = tab === "PO" ? totalCount : await prisma.purchaseOrder.count();

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
      />
    </div>
  );
}

function OrderTabs(props: {
  salesOrders: SalesOrderRow[]; purchaseOrders: PurchaseOrderRow[];
  initialTab: "SO" | "PO"; currentPage: number; totalPages: number;
  soCount: number; poCount: number;
}) {
  return <OrderTabsClient {...props} />;
}

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type SalesOrderRow = {
  id: string; orderCode: string; status: string; paymentStatus: string;
  fulfillmentType: string; totalAmount: string; saleDate: string | null;
  customer: { name: string } | null;
  items: Array<{ productName: string; qty: number }>;
};
type PurchaseOrderRow = {
  id: string; orderCode: string; status: string; paymentStatus: string;
  totalAmount: string; orderDate: string | null;
  supplier: { name: string } | null;
  items: Array<{ productName: string; qty: number }>;
};

export default async function OrdersPage() {
  const salesOrders = await prisma.salesOrder.findMany({
    orderBy: { createdAt: "desc" }, take: 100,
    include: { customer: { select: { name: true } }, items: { select: { productName: true, qty: true } } },
  });
  const purchaseOrders = await prisma.purchaseOrder.findMany({
    orderBy: { createdAt: "desc" }, take: 100,
    include: { supplier: { select: { name: true } }, items: { select: { productName: true, qty: true } } },
  });

  return (
    <div>
      <div style={{ marginBottom: "var(--space-6)" }}>
        <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, margin: 0 }}>Đơn hàng</h1>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--color-foreground-muted)", marginTop: "var(--space-1)" }}>
          {salesOrders.length} đơn bán · {purchaseOrders.length} đơn mua
        </p>
      </div>
      <OrderTabs
        salesOrders={JSON.parse(JSON.stringify(salesOrders)) as SalesOrderRow[]}
        purchaseOrders={JSON.parse(JSON.stringify(purchaseOrders)) as PurchaseOrderRow[]}
      />
    </div>
  );
}

import OrderTabsClient from "./OrderTabsClient";
function OrderTabs({ salesOrders, purchaseOrders }: { salesOrders: SalesOrderRow[]; purchaseOrders: PurchaseOrderRow[] }) {
  return <OrderTabsClient salesOrders={salesOrders} purchaseOrders={purchaseOrders} />;
}

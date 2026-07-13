import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { requirePermission, hasPermission } from "@/lib/authorize";
import EditOrderClient from "../EditOrderClient";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string; accountId?: string }>;
};

export default async function EditOrderPage(props: PageProps) {
  const { id } = await props.params;
  const session = await auth();
  await requirePermission(session?.user?.id, "order.view");

  const sp = await props.searchParams;
  const type: "SO" | "PO" = sp.type === "PO" ? "PO" : "SO";

  const isSO = type === "SO";
  const order = isSO
    ? await prisma.salesOrder.findUnique({ where: { id }, include: { items: true } })
    : await prisma.purchaseOrder.findUnique({ where: { id }, include: { items: true } });
  // Cast để truy cập saleDate/orderDate (schema đã có nhưng return type mặc định không kèm).
  const orderWithDate = order as unknown as { saleDate?: Date | null; orderDate?: Date | null } | null;

  if (!order) notFound();

  const products = await prisma.product.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  const accounts = await prisma.account.findMany({ where: { isActive: true }, orderBy: { code: "asc" } });

  const canEditDate = await hasPermission(session?.user?.id, "order.edit_date");

  const initialItems = order.items.map((it) => {
    if (isSO) {
      const soi = it as { productId: string | null; productName: string; unit: string; qty: number; sellPrice: unknown; baseCost: unknown; taxAmount: unknown };
      return {
        productId: soi.productId,
        productName: soi.productName,
        unit: soi.unit,
        qty: soi.qty,
        sellPrice: String(soi.sellPrice),
        baseCost: String(soi.baseCost),
        taxAmount: String(soi.taxAmount),
      };
    }
    const poi = it as { productId: string | null; productName: string; unit: string; qty: number; buyPrice: unknown; taxAmount: unknown };
    return {
      productId: poi.productId,
      productName: poi.productName,
      unit: poi.unit,
      qty: poi.qty,
      buyPrice: String(poi.buyPrice),
      taxAmount: String(poi.taxAmount),
    };
  });

  return (
    <div>
      <EditOrderClient
        initial={{
          id: order.id,
          orderCode: order.orderCode,
          status: order.status,
          type,
          items: initialItems,
          refundAccountId: sp.accountId ?? accounts[0]?.id,
          saleDate: orderWithDate?.saleDate
            ? (orderWithDate.saleDate instanceof Date
                ? orderWithDate.saleDate.toISOString().substring(0, 10)
                : String(orderWithDate.saleDate).substring(0, 10))
            : null,
          orderDate: orderWithDate?.orderDate
            ? (orderWithDate.orderDate instanceof Date
                ? orderWithDate.orderDate.toISOString().substring(0, 10)
                : String(orderWithDate.orderDate).substring(0, 10))
            : null,
        }}
        products={JSON.parse(JSON.stringify(products))}
        canEditDate={canEditDate}
      />
    </div>
  );
}
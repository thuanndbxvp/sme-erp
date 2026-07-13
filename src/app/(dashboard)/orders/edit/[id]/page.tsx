import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import EditOrderClient from "../EditOrderClient";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string; accountId?: string }>;
};

export default async function EditOrderPage(props: PageProps) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const type: "SO" | "PO" = sp.type === "PO" ? "PO" : "SO";

  const isSO = type === "SO";
  const order = isSO
    ? await prisma.salesOrder.findUnique({ where: { id }, include: { items: true } })
    : await prisma.purchaseOrder.findUnique({ where: { id }, include: { items: true } });

  if (!order) notFound();

  const products = await prisma.product.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  const accounts = await prisma.account.findMany({ where: { isActive: true }, orderBy: { code: "asc" } });

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
        }}
        products={JSON.parse(JSON.stringify(products))}
      />
    </div>
  );
}
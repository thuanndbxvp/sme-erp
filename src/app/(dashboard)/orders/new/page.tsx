import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function NewOrderPage() {
  const [customers, suppliers, warehouses, products, purchaseHistory] = await Promise.all([
    prisma.customer.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.supplier.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.warehouse.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.product.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.purchaseOrderItem.findMany({
      where: { productId: { not: null } },
      select: { productId: true, purchaseOrder: { select: { supplierId: true } } },
    }),
  ]);

  const productSupplierMap: Record<string, string[]> = {};
  for (const item of purchaseHistory) {
    if (item.productId && item.purchaseOrder?.supplierId) {
      if (!productSupplierMap[item.productId]) {
        productSupplierMap[item.productId] = [];
      }
      if (!productSupplierMap[item.productId]!.includes(item.purchaseOrder.supplierId)) {
        productSupplierMap[item.productId]!.push(item.purchaseOrder.supplierId);
      }
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, marginBottom: "var(--space-6)" }}>Tạo đơn hàng mới</h1>
      <UnifiedOrderForm
        customers={JSON.parse(JSON.stringify(customers))}
        suppliers={JSON.parse(JSON.stringify(suppliers))}
        warehouses={JSON.parse(JSON.stringify(warehouses))}
        products={JSON.parse(JSON.stringify(products))}
        productSupplierMap={productSupplierMap}
      />
    </div>
  );
}

import UnifiedOrderForm from "./UnifiedOrderForm";

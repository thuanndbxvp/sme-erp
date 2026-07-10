import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function NewOrderPage() {
  const [customers, suppliers, warehouses, products, accounts] = await Promise.all([
    prisma.customer.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.supplier.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.warehouse.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.product.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.account.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
  ]);

  return (
    <div>
      <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, marginBottom: "var(--space-6)" }}>Tạo đơn hàng mới</h1>
      <UnifiedOrderForm
        customers={JSON.parse(JSON.stringify(customers))}
        suppliers={JSON.parse(JSON.stringify(suppliers))}
        warehouses={JSON.parse(JSON.stringify(warehouses))}
        products={JSON.parse(JSON.stringify(products))}
        accounts={JSON.parse(JSON.stringify(accounts))}
      />
    </div>
  );
}

import UnifiedOrderForm from "./UnifiedOrderForm";

import { prisma } from "@/lib/prisma";
import AuditTable from "@/components/audit/AuditTable";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
    select: { id: true, action: true, entityType: true, entityId: true, userId: true, createdAt: true, metadata: true },
  });

  const userIds = Array.from(new Set(logs.map(l => l.userId).filter(Boolean))) as string[];
  const productIds = new Set<string>();
  const warehouseIds = new Set<string>();

  logs.forEach(l => {
    if (l.metadata && typeof l.metadata === "object" && !Array.isArray(l.metadata)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const meta = l.metadata as any;
      if (meta.productId) productIds.add(meta.productId);
      if (meta.warehouseId) warehouseIds.add(meta.warehouseId);
    }
  });

  const [users, products, warehouses] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }),
    prisma.product.findMany({ where: { id: { in: Array.from(productIds) } }, select: { id: true, name: true } }),
    prisma.warehouse.findMany({ where: { id: { in: Array.from(warehouseIds) } }, select: { id: true, name: true } })
  ]);
  
  const userMap = new Map(users.map(u => [u.id, u.name]));
  const productMap = new Map(products.map(p => [p.id, p.name]));
  const warehouseMap = new Map(warehouses.map(w => [w.id, w.name]));

  const logsWithUser = logs.map(l => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const enrichedMeta = l.metadata && typeof l.metadata === "object" ? { ...(l.metadata as any) } : {};
    
    if (enrichedMeta.productId) {
      enrichedMeta.productName = productMap.get(enrichedMeta.productId) || enrichedMeta.productId;
      delete enrichedMeta.productId; // Ẩn mã ID thô
    }
    if (enrichedMeta.warehouseId) {
      enrichedMeta.warehouseName = warehouseMap.get(enrichedMeta.warehouseId) || enrichedMeta.warehouseId;
      delete enrichedMeta.warehouseId; // Ẩn mã ID thô
    }

    return {
      ...l,
      metadata: enrichedMeta,
      userName: l.userId ? (userMap.get(l.userId) || "Không xác định") : "Hệ thống"
    };
  });

  return (
    <div>
      <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, marginBottom: "var(--space-1)" }}>
        Nhật ký hoạt động
      </h1>
      <p style={{ fontSize: "var(--text-sm)", color: "var(--color-foreground-muted)", marginBottom: "var(--space-6)" }}>
        {logs.length} bản ghi gần nhất
      </p>
      <AuditTable logs={logsWithUser} />
    </div>
  );
}

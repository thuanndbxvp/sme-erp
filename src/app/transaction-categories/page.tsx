import { prisma } from "@/lib/prisma";
import CategoriesClient from "./CategoriesClient";

export const dynamic = "force-dynamic";

export default async function TransactionCategoriesPage() {
  const cats = await prisma.$queryRawUnsafe<Array<{ id: string; name: string; type: string; parentId: string | null; isActive: boolean; createdAt: Date }>>(
    `SELECT * FROM "TransactionCategory" ORDER BY "type", "name"`
  );
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-6)" }}>
        <div>
          <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, margin: 0 }}>Danh mục dòng tiền</h1>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-foreground-muted)", marginTop: "var(--space-1)" }}>
            2 danh mục gốc: Dòng tiền Kinh doanh, Dòng tiền Vận hành
          </p>
        </div>
      </div>
      <CategoriesClient categories={JSON.parse(JSON.stringify(cats))} />
    </div>
  );
}

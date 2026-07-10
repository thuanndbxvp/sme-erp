"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FieldConfig } from "@/domain/catalog-registry";
import type { ActionResult } from "@/lib/action-result";
import { Table, type Column } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { PlusIcon, EditIcon } from "@/components/ui/icons";

interface Props {
  entity: string;
  labelPlural: string;
  fields: FieldConfig[];
  rows: Array<Record<string, string>>;
  deactivate: (id: string) => Promise<ActionResult<{ id: string }>>;
}

export function CatalogTable({ entity, labelPlural, fields, rows, deactivate }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const listFields = fields.filter((f) => f.inList);

  function onDeactivate(id: string) {
    startTransition(async () => {
      await deactivate(id);
      router.refresh();
    });
  }

  const columns: Column<Record<string, string>>[] = listFields.map((f) => ({
    key: f.name,
    header: f.label,
    align: f.type === "money" ? ("right" as const) : ("left" as const),
  }));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-5)" }}>
        <div>
          <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, color: "var(--color-foreground)", margin: 0 }}>
            {labelPlural}
          </h1>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-foreground-muted)", marginTop: "var(--space-1)" }}>
            {rows.length} mục
          </p>
        </div>
        <Link href={`/catalog/${entity}/new`}>
          <Button variant="primary">
            <PlusIcon size={16} />
            Thêm mới
          </Button>
        </Link>
      </div>

      <Table
        columns={columns}
        rows={rows}
        getRowKey={(r) => r.id ?? ""}
        emptyMessage={`Chưa có ${labelPlural.toLowerCase()} nào`}
        actions={(row) => {
          const id = row.id ?? "";
          return (
            <>
              <Link href={`/catalog/${entity}/${id}/edit`}>
                <Button variant="ghost" size="sm" aria-label={`Sửa ${id}`}>
                  <EditIcon size={14} />
                </Button>
              </Link>
              <Button variant="ghost" size="sm" disabled={pending} onClick={() => onDeactivate(id)} aria-label={`Ngừng ${id}`}>
                Ẩn
              </Button>
            </>
          );
        }}
      />
    </div>
  );
}

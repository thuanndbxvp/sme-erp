"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FieldConfig } from "@/domain/catalog-registry";
import type { ActionResult } from "@/lib/action-result";

interface Props {
  entity: string;
  labelPlural: string;
  fields: FieldConfig[];
  rows: Array<Record<string, string>>;
  deactivate: (id: string) => Promise<ActionResult<{ id: string }>>;
}

/**
 * Bảng danh mục generic (client). Chỉ hiển thị field inList. Nút "Ngừng dùng"
 * gọi soft-delete action. Row là dữ liệu đã stringify từ server component.
 */
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

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>{labelPlural}</h1>
        <Link href={`/catalog/${entity}/new`}>+ Thêm mới</Link>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12 }}>
        <thead>
          <tr>
            {listFields.map((f) => (
              <th key={f.name} style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>
                {f.label}
              </th>
            ))}
            <th style={{ borderBottom: "1px solid #ccc", padding: 8 }}></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={listFields.length + 1} style={{ padding: 8, color: "#888" }}>
                Chưa có dữ liệu
              </td>
            </tr>
          )}
          {rows.map((row) => {
            const id = row.id ?? "";
            return (
              <tr key={id}>
                {listFields.map((f) => (
                  <td key={f.name} style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                    {row[f.name] ?? ""}
                  </td>
                ))}
                <td style={{ padding: 8, borderBottom: "1px solid #eee", whiteSpace: "nowrap" }}>
                  <Link href={`/catalog/${entity}/${id}/edit`}>Sửa</Link>{" "}
                  <button type="button" disabled={pending} onClick={() => onDeactivate(id)}>
                    Ngừng dùng
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { FieldConfig } from "@/domain/catalog-registry";
import type { ActionResult } from "@/lib/action-result";

interface Props {
  entity: string;
  labelPlural: string;
  fields: FieldConfig[];
  mode: "create" | "edit";
  /** Giá trị hiện tại khi edit (chuỗi). */
  initial?: Record<string, string>;
  action: (formData: FormData) => Promise<ActionResult<{ id: string }>>;
}

/**
 * Form danh mục generic (client). Gọi server action, hiển thị lỗi field/chung.
 * Khi edit: field createOnly bị khóa (readonly) — sku/code không đổi.
 */
export function CatalogForm({ entity, labelPlural, fields, mode, initial, action }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const editableFields =
    mode === "edit" ? fields.filter((f) => !f.createOnly) : fields;

  function onSubmit(formData: FormData) {
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const result = await action(formData);
      if (result.ok) {
        router.push(`/catalog/${entity}`);
        router.refresh();
      } else {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
      }
    });
  }

  return (
    <form action={onSubmit} style={{ maxWidth: 480, display: "grid", gap: 12 }}>
      <h1>
        {mode === "create" ? "Thêm" : "Sửa"} {labelPlural}
      </h1>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {editableFields.map((f) => (
        <label key={f.name} style={{ display: "grid", gap: 4 }}>
          <span>{f.label}</span>
          <input
            name={f.name}
            type={f.type === "money" ? "number" : "text"}
            step={f.type === "money" ? "0.01" : undefined}
            defaultValue={initial?.[f.name] ?? ""}
            aria-invalid={fieldErrors[f.name] ? true : undefined}
          />
          {fieldErrors[f.name] && (
            <span style={{ color: "crimson", fontSize: 12 }}>{fieldErrors[f.name]}</span>
          )}
        </label>
      ))}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" disabled={pending}>
          {pending ? "Đang lưu..." : "Lưu"}
        </button>
        <button type="button" onClick={() => router.push(`/catalog/${entity}`)}>
          Hủy
        </button>
      </div>
    </form>
  );
}

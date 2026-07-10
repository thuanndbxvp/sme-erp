"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { FieldConfig } from "@/domain/catalog-registry";
import type { ActionResult } from "@/lib/action-result";
import { Button } from "@/components/ui/Button";
import { ArrowLeftIcon } from "@/components/ui/icons";

interface Props {
  entity: string;
  labelPlural: string;
  fields: FieldConfig[];
  mode: "create" | "edit";
  initial?: Record<string, string>;
  action: (formData: FormData) => Promise<ActionResult<{ id: string }>>;
}

export function CatalogForm({ entity, labelPlural, fields, mode, initial, action }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const editableFields = mode === "edit" ? fields.filter((f) => !f.createOnly) : fields;

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
    <div style={{ maxWidth: 560 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", marginBottom: "var(--space-6)" }}>
        <button
          type="button"
          onClick={() => router.push(`/catalog/${entity}`)}
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border-strong)",
            borderRadius: "var(--radius-md)",
            width: 36,
            height: 36,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "var(--color-foreground-muted)",
          }}
          aria-label="Quay lại"
        >
          <ArrowLeftIcon size={18} />
        </button>
        <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, margin: 0 }}>
          {mode === "create" ? "Thêm" : "Sửa"} {labelPlural}
        </h1>
      </div>

      {/* Error summary */}
      {error && (
        <div style={{ padding: "var(--space-3) var(--space-4)", background: "var(--color-destructive-bg)", color: "var(--color-destructive)", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", marginBottom: "var(--space-4)", border: "1px solid var(--color-destructive)" }}>
          {error}
        </div>
      )}

      {/* Form */}
      <form
        action={onSubmit}
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg)",
          padding: "var(--space-6)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div style={{ display: "grid", gap: "var(--space-5)" }}>
          {editableFields.map((f) => (
            <FormField key={f.name} field={f} initial={initial} error={fieldErrors[f.name]} />
          ))}
        </div>

        <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-6)" }}>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Đang lưu..." : mode === "create" ? "Tạo mới" : "Lưu thay đổi"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => router.push(`/catalog/${entity}`)}>
            Hủy
          </Button>
        </div>
      </form>
    </div>
  );
}

function FormField({
  field,
  initial,
  error,
}: {
  field: FieldConfig;
  initial?: Record<string, string>;
  error?: string;
}) {
  const id = `field-${field.name}`;
  const isMoney = field.type === "money";

  return (
    <div>
      <label
        htmlFor={id}
        style={{
          display: "block",
          fontSize: "var(--text-sm)",
          fontWeight: 600,
          color: "var(--color-foreground)",
          marginBottom: "var(--space-1)",
        }}
      >
        {field.label}
        {field.createOnly && (
          <span style={{ color: "var(--color-foreground-subtle)", fontWeight: 400, marginLeft: "var(--space-2)", fontSize: "var(--text-xs)" }}>
            (chỉ nhập khi tạo)
          </span>
        )}
      </label>
      <input
        id={id}
        name={field.name}
        type={isMoney ? "number" : "text"}
        step={isMoney ? "0.01" : undefined}
        defaultValue={initial?.[field.name] ?? ""}
        readOnly={field.createOnly}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        style={{
          width: "100%",
          height: "var(--touch-target)",
          padding: "0 var(--space-3)",
          border: `1px solid ${error ? "var(--color-destructive)" : "var(--color-border-strong)"}`,
          borderRadius: "var(--radius-md)",
          fontSize: "var(--text-base)",
          fontFamily: "var(--font-sans)",
          background: field.createOnly ? "var(--color-muted)" : "var(--color-surface)",
          color: "var(--color-foreground)",
          outline: "none",
          transition: "border-color 150ms",
        }}
        onFocus={(e) => {
          if (!error) e.currentTarget.style.borderColor = "var(--color-primary)";
        }}
        onBlur={(e) => {
          if (!error) e.currentTarget.style.borderColor = "var(--color-border-strong)";
        }}
      />
      {error && (
        <div id={`${id}-error`} role="alert" style={{ color: "var(--color-destructive)", fontSize: "var(--text-xs)", marginTop: "var(--space-1)" }}>
          {error}
        </div>
      )}
    </div>
  );
}

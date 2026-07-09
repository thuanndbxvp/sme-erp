import type { FieldConfig } from "@/domain/catalog-registry";

/**
 * Chuyển record từ DB (có Decimal/Date/null) → map chuỗi cho UI client.
 * Chỉ lấy id + các field khai báo trong config.
 */
export function serializeRow(
  record: Record<string, unknown>,
  fields: FieldConfig[],
): Record<string, string> {
  const out: Record<string, string> = { id: String(record.id ?? "") };
  for (const f of fields) {
    const v = record[f.name];
    out[f.name] = v === null || v === undefined ? "" : String(v);
  }
  return out;
}

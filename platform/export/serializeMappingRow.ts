import type { MappingExportColumn, MappingExportSchema } from "../contract/loadMappingExportSchema";
import type { MappingRow } from "./types";

function applyTransform(value: string, column: MappingExportColumn): string {
  let result = value;
  const transform = column.transform;

  if (!transform) {
    return result;
  }

  if (transform.trim) {
    result = result.trim();
  }
  if (transform.uppercase) {
    result = result.toUpperCase();
  }
  if (transform.lowercase) {
    result = result.toLowerCase();
  }
  if (transform.maxLength !== undefined && result.length > transform.maxLength) {
    result = result.slice(0, transform.maxLength);
  }
  if (transform.join && Array.isArray((value as unknown as string[]))) {
    const parts = value as unknown as string[];
    result = transform.sortParts
      ? [...parts].sort().join(transform.join)
      : parts.join(transform.join);
  }

  return result;
}

function readDbValue(row: MappingRow, dbColumn: string): string {
  const record = row as Record<string, string | undefined>;
  const raw = record[dbColumn];
  return raw ?? "";
}

export function resolveRoleExportValue(row: MappingRow): string {
  if (row.role_override?.trim()) {
    return row.role_override.trim();
  }
  if (row.role_inferred?.trim()) {
    return row.role_inferred.trim();
  }
  return row.role_export?.trim() ?? "";
}

export function serializeMappingCell(
  row: MappingRow,
  column: MappingExportColumn,
): string {
  let value = readDbValue(row, column.dbColumn);

  if (column.dbColumn === "role_export") {
    value = resolveRoleExportValue(row);
  }

  if (!value && value !== "0") {
    return column.defaultWhenNull ?? "";
  }

  return applyTransform(value, column);
}

export function serializeMappingRow(
  row: MappingRow,
  schema: MappingExportSchema,
): string[] {
  return schema.columns.map((column) => serializeMappingCell(row, column));
}

export function serializeMappingRowRecord(
  row: MappingRow,
  schema: MappingExportSchema,
): Record<string, string> {
  const record: Record<string, string> = {};
  for (let index = 0; index < schema.columns.length; index += 1) {
    const column = schema.columns[index];
    record[column.excelHeader] = serializeMappingCell(row, column);
  }
  return record;
}

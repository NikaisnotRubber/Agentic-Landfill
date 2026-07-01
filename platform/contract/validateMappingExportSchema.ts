import type { MappingExportSchema } from "./loadMappingExportSchema";

export function validateMappingExportSchema(parsed: MappingExportSchema): MappingExportSchema {
  if (!parsed.columns?.length) {
    throw new Error("mapping-export-schema.json must define columns[]");
  }

  const headers = new Set<string>();
  const dbColumns = new Set<string>();
  for (const column of parsed.columns) {
    if (headers.has(column.excelHeader)) {
      throw new Error(`Duplicate excelHeader: ${column.excelHeader}`);
    }
    if (dbColumns.has(column.dbColumn)) {
      throw new Error(`Duplicate dbColumn: ${column.dbColumn}`);
    }
    headers.add(column.excelHeader);
    dbColumns.add(column.dbColumn);
  }

  return parsed;
}

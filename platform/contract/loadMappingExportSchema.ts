import { readFile } from "node:fs/promises";
import path from "node:path";

export type MappingExportTransform = {
  trim?: boolean;
  uppercase?: boolean;
  lowercase?: boolean;
  maxLength?: number;
  join?: string;
  sortParts?: boolean;
};

export type MappingExportColumn = {
  excelHeader: string;
  dbColumn: string;
  mappingFieldId?: string;
  logicalType: string;
  storageType: string;
  exportType: string;
  nullable: boolean;
  defaultWhenNull: string;
  transform?: MappingExportTransform;
  readonly?: boolean;
  inTicketWorkbook?: boolean;
};

export type MappingExportSchema = {
  version: string;
  columns: MappingExportColumn[];
  ticketOnlyColumns: { excelHeader: string }[];
  internalColumns: { dbColumn: string }[];
};

const DEFAULT_SCHEMA_PATH = path.resolve(
  process.cwd(),
  "docs/superpowers/fixtures/mapping-export-schema.json",
);

export async function loadMappingExportSchema(
  schemaPath = DEFAULT_SCHEMA_PATH,
): Promise<MappingExportSchema> {
  const raw = await readFile(schemaPath, "utf8");
  const parsed = JSON.parse(raw) as MappingExportSchema;

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

export function getMappingExcelHeaders(schema: MappingExportSchema): string[] {
  return schema.columns.map((column) => column.excelHeader);
}

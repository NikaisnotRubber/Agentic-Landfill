import { readFile } from "node:fs/promises";
import path from "node:path";

import { validateMappingExportSchema } from "./validateMappingExportSchema";

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
  decisionId?: string;
  decision?: string;
  ticketExportDefault?: string;
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
  return validateMappingExportSchema(JSON.parse(raw) as MappingExportSchema);
}

export { validateMappingExportSchema } from "./validateMappingExportSchema";

export function getMappingExcelHeaders(schema: MappingExportSchema): string[] {
  return schema.columns.map((column) => column.excelHeader);
}

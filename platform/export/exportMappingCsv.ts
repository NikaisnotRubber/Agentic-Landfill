import { writeFile } from "node:fs/promises";

import { getMappingExcelHeaders, loadMappingExportSchema } from "../contract/loadMappingExportSchema";
import type { PlatformDatabase } from "../db/database";
import { loadMappingRows } from "../mapping/materializeMappingRows";
import { serializeMappingRow } from "./serializeMappingRow";

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function exportMappingCsv(options: {
  db: PlatformDatabase;
  batchId: string;
  outputPath: string;
  utf8Bom?: boolean;
}): Promise<{ rowCount: number; outputPath: string }> {
  const schema = await loadMappingExportSchema();
  const headers = getMappingExcelHeaders(schema);
  const rows = loadMappingRows(options.db, options.batchId);

  const lines = [
    headers.map(escapeCsvCell).join(","),
    ...rows.map((row) => serializeMappingRow(row, schema).map(escapeCsvCell).join(",")),
  ];

  const body = lines.join("\r\n");
  const payload = options.utf8Bom !== false ? `\uFEFF${body}` : body;
  await writeFile(options.outputPath, payload, "utf8");

  return { rowCount: rows.length, outputPath: options.outputPath };
}

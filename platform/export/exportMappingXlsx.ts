import ExcelJS from "exceljs";

import { getMappingExcelHeaders, loadMappingExportSchema } from "../contract/loadMappingExportSchema";
import type { PlatformDatabase } from "../db/database";
import { loadMappingRows } from "../mapping/materializeMappingRows";
import { serializeMappingRow } from "./serializeMappingRow";

export async function exportMappingXlsx(options: {
  db: PlatformDatabase;
  batchId: string;
  outputPath: string;
}): Promise<{ rowCount: number; outputPath: string }> {
  const schema = await loadMappingExportSchema();
  const headers = getMappingExcelHeaders(schema);
  const rows = loadMappingRows(options.db, options.batchId);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("AD User VM Mapping");

  sheet.addRow(headers);
  for (const row of rows) {
    sheet.addRow(serializeMappingRow(row, schema));
  }

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };

  await workbook.xlsx.writeFile(options.outputPath);

  return { rowCount: rows.length, outputPath: options.outputPath };
}

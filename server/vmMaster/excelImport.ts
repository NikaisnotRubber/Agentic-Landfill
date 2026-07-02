import ExcelJS from "exceljs";

export const vmMasterExcelImportFields = [
  "AD_NAME",
  "CHN_NAME",
  "EMAIL_ADDRESS",
  "BG",
  "BU",
  "USER_ROLE",
  "GROUP_NAME",
  "VM_NAME",
  "MAX_ONLINE_USERS",
  "ZENTERA_ROLE",
  "USER_DEPT",
  "REPORT_TO",
  "BU_CURR",
  "BG_CURR",
] as const;

export type VmMasterExcelImportField = (typeof vmMasterExcelImportFields)[number];
export type VmMasterExcelImportMapping = Record<string, VmMasterExcelImportField>;

export type VmMasterExcelPreviewSampleRow = {
  rowNumber: number;
  values: Record<string, string>;
};

export type VmMasterExcelPreview = {
  fileName: string;
  worksheetName: string;
  headers: string[];
  rowCount: number;
  sampleRows: VmMasterExcelPreviewSampleRow[];
  importableFields: readonly VmMasterExcelImportField[];
  defaultMapping: Partial<Record<string, VmMasterExcelImportField>>;
};

type HeaderColumn = {
  header: string;
  columnNumber: number;
};

const fieldsByNormalizedName = new Map(
  vmMasterExcelImportFields.map((field) => [normalizeFieldName(field), field] as const),
);

function normalizeFieldName(value: string): string {
  return value.trim().toUpperCase().replace(/[\s_-]/g, "");
}

function toCellText(value: ExcelJS.CellValue): string {
  if (value == null) {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value !== "object") {
    return String(value).trim();
  }

  if ("result" in value && value.result != null) {
    return toCellText(value.result as ExcelJS.CellValue);
  }

  if ("richText" in value && Array.isArray(value.richText)) {
    return value.richText
      .map((part) => (typeof part?.text === "string" ? part.text : ""))
      .join("")
      .trim();
  }

  if ("text" in value && typeof value.text === "string") {
    return value.text.trim();
  }

  if ("hyperlink" in value && typeof value.hyperlink === "string") {
    return value.hyperlink.trim();
  }

  if ("error" in value && typeof value.error === "string") {
    return value.error.trim();
  }

  return "";
}

function readHeaderColumns(worksheet: ExcelJS.Worksheet): HeaderColumn[] {
  const headers: HeaderColumn[] = [];

  worksheet.getRow(1).eachCell({ includeEmpty: true }, (cell, columnNumber) => {
    const header = toCellText(cell.value);

    if (header) {
      headers.push({ header, columnNumber });
    }
  });

  return headers;
}

function rowHasData(row: ExcelJS.Row, columnCount: number): boolean {
  for (let columnNumber = 1; columnNumber <= columnCount; columnNumber += 1) {
    if (toCellText(row.getCell(columnNumber).value)) {
      return true;
    }
  }

  return false;
}

function readSampleValues(row: ExcelJS.Row, headers: HeaderColumn[]): Record<string, string> {
  const values: Record<string, string> = {};

  for (const { header, columnNumber } of headers) {
    values[header] = toCellText(row.getCell(columnNumber).value);
  }

  return values;
}

export function buildDefaultExcelImportMapping(
  headers: string[],
): Partial<Record<string, VmMasterExcelImportField>> {
  const mapping: Partial<Record<string, VmMasterExcelImportField>> = {};

  for (const header of headers) {
    const field = fieldsByNormalizedName.get(normalizeFieldName(header));

    if (field) {
      mapping[header] = field;
    }
  }

  return mapping;
}

export function validateVmMasterExcelMapping(
  mapping: Partial<Record<string, string>>,
): VmMasterExcelImportMapping {
  const normalizedMapping: VmMasterExcelImportMapping = {};
  const seenFields = new Set<VmMasterExcelImportField>();

  for (const [header, rawField] of Object.entries(mapping)) {
    const trimmedField = rawField?.trim() ?? "";

    if (!trimmedField) {
      continue;
    }

    const field = fieldsByNormalizedName.get(normalizeFieldName(trimmedField));

    if (!field) {
      throw new Error(`Invalid VM Master import target field: ${rawField}`);
    }

    if (seenFields.has(field)) {
      throw new Error(`Duplicate VM Master import target field: ${rawField}`);
    }

    seenFields.add(field);
    normalizedMapping[header] = field;
  }

  if (!seenFields.has("AD_NAME")) {
    throw new Error("VM Master Excel import requires an AD_NAME mapping");
  }

  return normalizedMapping;
}

export async function parseVmMasterExcelPreview({
  fileName,
  workbookBuffer,
}: {
  fileName: string;
  workbookBuffer: Buffer;
}): Promise<VmMasterExcelPreview> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(workbookBuffer);
  let foundHeaders = false;

  for (const worksheet of workbook.worksheets) {
    const headerColumns = readHeaderColumns(worksheet);

    if (headerColumns.length === 0) {
      continue;
    }

    foundHeaders = true;

    const sampleRows: VmMasterExcelPreviewSampleRow[] = [];
    let rowCount = 0;

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);

      if (!rowHasData(row, worksheet.columnCount)) {
        continue;
      }

      rowCount += 1;

      if (sampleRows.length < 5) {
        sampleRows.push({
          rowNumber,
          values: readSampleValues(row, headerColumns),
        });
      }
    }

    if (rowCount === 0) {
      continue;
    }

    const headers = headerColumns.map(({ header }) => header);

    return {
      fileName,
      worksheetName: worksheet.name,
      headers,
      rowCount,
      sampleRows,
      importableFields: vmMasterExcelImportFields,
      defaultMapping: buildDefaultExcelImportMapping(headers),
    };
  }

  if (workbook.worksheets.length === 0) {
    throw new Error("VM Master Excel import requires a worksheet with headers and data");
  }

  if (!foundHeaders) {
    throw new Error("VM Master Excel import requires header columns");
  }

  throw new Error("VM Master Excel import requires at least one data row");
}

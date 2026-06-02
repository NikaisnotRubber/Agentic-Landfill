import ExcelJS from "exceljs";

import type { ProcessedDdpRow } from "../ddp/types";
import type { TicketRecord } from "../types";
import {
  assertDdpExcelRowShape,
  buildDdpExcelRowRecords,
  type DdpExcelRowRecord,
} from "./buildDdpExcelRows";
import {
  DDP_EXCEL_ABNORMAL_FILL,
  DDP_EXCEL_COLUMNS,
  DDP_EXCEL_HEADER_FILL_ALT,
  DDP_EXCEL_HEADER_FILL_PRIMARY,
  DDP_EXCEL_PENDING_FILL,
  DDP_EXCEL_SHEET_ALL,
  DDP_EXCEL_SHEET_CLOSED,
  DDP_EXCEL_SHEET_PENDING,
  DDP_EXCEL_STATUS_COLUMN_INDEX,
} from "./ddpExcelColumns";

function charWidth(value: unknown): number {
  const text = value === null || value === undefined ? "" : String(value);
  let width = 0;
  for (const char of text) {
    width += char.charCodeAt(0) > 127 ? 2 : 1;
  }
  return width;
}

function autoWidth(worksheet: ExcelJS.Worksheet): void {
  worksheet.columns.forEach((column) => {
    if (!column || typeof column.eachCell !== "function") {
      return;
    }

    let maxLen = 0;
    column.eachCell({ includeEmpty: true }, (cell) => {
      const cellText =
        typeof cell.value === "object" && cell.value !== null && "text" in cell.value
          ? String((cell.value as { text: string }).text)
          : String(cell.value ?? "");
      maxLen = Math.max(maxLen, charWidth(cellText));
    });

    column.width = Math.max(Math.min(maxLen + 4, 80), 8);
  });
}

function applyHeaderFill(worksheet: ExcelJS.Worksheet): void {
  const headerRow = worksheet.getRow(1);
  for (let col = 1; col <= DDP_EXCEL_COLUMNS.length; col += 1) {
    const cell = headerRow.getCell(col);
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: col <= 3 ? DDP_EXCEL_HEADER_FILL_PRIMARY : DDP_EXCEL_HEADER_FILL_ALT },
    };
  }
}

function writeDataRow(
  worksheet: ExcelJS.Worksheet,
  record: DdpExcelRowRecord,
  options: { withPendingFill: boolean },
): void {
  assertDdpExcelRowShape(record);
  const row = worksheet.addRow(record.values);
  const rowNumber = row.number;

  if (record.ticketUrl) {
    const idCell = row.getCell(1);
    idCell.value = {
      text: String(record.ticketId),
      hyperlink: record.ticketUrl,
    };
    idCell.font = { color: { argb: "FF0563C1" }, underline: true };
  }

  if (options.withPendingFill) {
    row.getCell(DDP_EXCEL_STATUS_COLUMN_INDEX).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: DDP_EXCEL_PENDING_FILL },
    };
  }

  if (record.abnormalFlag && record.abnormalHyperlink) {
    const abnormalCell = row.getCell(2);
    abnormalCell.value = {
      text: record.abnormalSubject,
      hyperlink: record.abnormalHyperlink,
    };
    abnormalCell.font = { color: { argb: "FF0563C1" }, underline: true };
    abnormalCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: DDP_EXCEL_ABNORMAL_FILL },
    };
  }
}

function createSheet(workbook: ExcelJS.Workbook, title: string): ExcelJS.Worksheet {
  const worksheet = workbook.addWorksheet(title);
  worksheet.addRow([...DDP_EXCEL_COLUMNS]);
  applyHeaderFill(worksheet);
  return worksheet;
}

export type ExportDdpWorkbookResult = {
  buffer: Buffer;
  pendingCount: number;
  closedCount: number;
  totalCount: number;
};

export async function exportDdpWorkbookBuffer(options: {
  tickets: TicketRecord[];
  processedRows?: ProcessedDdpRow[];
}): Promise<ExportDdpWorkbookResult> {
  const records = buildDdpExcelRowRecords(options.tickets, options.processedRows ?? []);
  const workbook = new ExcelJS.Workbook();

  const pendingSheet = createSheet(workbook, DDP_EXCEL_SHEET_PENDING);
  const closedSheet = createSheet(workbook, DDP_EXCEL_SHEET_CLOSED);
  const allSheet = createSheet(workbook, DDP_EXCEL_SHEET_ALL);

  let pendingCount = 0;
  let closedCount = 0;

  for (const record of records) {
    writeDataRow(allSheet, record, { withPendingFill: record.isPending });

    if (record.isPending) {
      writeDataRow(pendingSheet, record, { withPendingFill: true });
      pendingCount += 1;
    }

    if (record.status === "Closed") {
      writeDataRow(closedSheet, record, { withPendingFill: false });
      closedCount += 1;
    }
  }

  for (const sheet of [pendingSheet, closedSheet, allSheet]) {
    autoWidth(sheet);
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    pendingCount,
    closedCount,
    totalCount: records.length,
  };
}

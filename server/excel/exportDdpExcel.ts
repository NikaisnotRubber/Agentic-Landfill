import { writeFile } from "node:fs/promises";
import path from "node:path";

import type { ProcessedDdpRow } from "../ddp/types";
import type { TicketRecord } from "../types";
import { DDP_EXCEL_DEFAULT_FILENAME } from "./ddpExcelColumns";
import { exportDdpWorkbookBuffer, type ExportDdpWorkbookResult } from "./exportDdpWorkbook";

function formatTimestampedFilename(baseName: string): string {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    "_",
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
  ].join("");

  const parsed = path.parse(baseName);
  const suffix = parsed.ext || ".xlsx";
  const stem = parsed.name || "ddp_ticket_maintain";
  return `${stem}_${stamp}${suffix}`;
}

export async function writeDdpExcelFile(
  buffer: Buffer,
  outputPath: string,
): Promise<{ writtenPath: string; usedFallback: boolean }> {
  try {
    await writeFile(outputPath, buffer);
    return { writtenPath: outputPath, usedFallback: false };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "EBUSY" && code !== "EPERM" && code !== "EACCES") {
      throw error;
    }
  }

  const fallbackPath = path.join(
    path.dirname(outputPath),
    formatTimestampedFilename(path.basename(outputPath)),
  );
  await writeFile(fallbackPath, buffer);
  return { writtenPath: fallbackPath, usedFallback: true };
}

export async function exportDdpExcelToBuffer(options: {
  tickets: TicketRecord[];
  processedRows?: ProcessedDdpRow[];
}): Promise<ExportDdpWorkbookResult> {
  return exportDdpWorkbookBuffer(options);
}

export async function exportDdpExcelToFile(options: {
  tickets: TicketRecord[];
  processedRows?: ProcessedDdpRow[];
  outputPath?: string;
}): Promise<ExportDdpWorkbookResult & { writtenPath: string; usedFallback: boolean }> {
  const result = await exportDdpWorkbookBuffer(options);
  const outputPath =
    options.outputPath?.trim() ||
    process.env.EXCEL_OUTPUT?.trim() ||
    DDP_EXCEL_DEFAULT_FILENAME;
  const writeResult = await writeDdpExcelFile(result.buffer, outputPath);
  return { ...result, ...writeResult };
}

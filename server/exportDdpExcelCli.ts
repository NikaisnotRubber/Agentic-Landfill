import path from "node:path";

import { processDdpTickets } from "./ddp/processDdpTickets";
import { exportDdpExcelToFile } from "./excel/exportDdpExcel";
import { readSampleTickets } from "./sampleTickets";

async function main() {
  const outputArg = process.argv.find((arg) => arg.startsWith("--output="));
  const outputPath = outputArg?.slice("--output=".length);

  const sample = await readSampleTickets();
  const processed = processDdpTickets(sample.tickets);

  const result = await exportDdpExcelToFile({
    tickets: sample.tickets,
    processedRows: processed.rows,
    outputPath: outputPath || path.resolve("ddp_ticket_maintain.xlsx"),
  });

  const suffix = result.usedFallback ? " (locked file fallback)" : "";
  console.log(
    `Wrote ${result.writtenPath}${suffix} — pending ${result.pendingCount}, closed ${result.closedCount}, total ${result.totalCount}`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

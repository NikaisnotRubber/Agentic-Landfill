import path from "node:path";

import { fetchAndEnrichTickets } from "./fetchAndEnrichTickets";
import { exportDdpExcelToFile } from "./excel/exportDdpExcel";

async function main() {
  const count = Number(process.argv.find((arg) => arg.startsWith("--count="))?.slice(8) ?? 25);
  const outputArg = process.argv.find((arg) => arg.startsWith("--output="));
  const outputPath = outputArg?.slice("--output=".length) ?? path.resolve("ddp_ticket_maintain.xlsx");

  console.log(`Fetching ${count} DDP tickets with AD enrich...`);
  const result = await fetchAndEnrichTickets({ count });

  if (!result.ok) {
    console.error(result.error);
    process.exit(1);
  }

  console.log(`Fetched ${result.count} tickets. Exporting Excel...`);
  const exportResult = await exportDdpExcelToFile({
    tickets: result.tickets,
    processedRows: result.processedRows,
    outputPath,
  });

  console.log(
    `Wrote ${exportResult.writtenPath} (pending ${exportResult.pendingCount}, closed ${exportResult.closedCount}, total ${exportResult.totalCount})`,
  );

  if (result.adWarning) {
    console.warn(`AD warning: ${result.adWarning}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

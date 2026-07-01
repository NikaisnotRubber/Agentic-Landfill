import {
  applyVmMasterSchema,
  openVmMasterDatabase,
} from "../server/db/sqlite";
import { readVmMasterCsv } from "../server/vmMaster/csv";
import { importVmMasterRows } from "../server/vmMaster/import";

const csvPath = process.argv[2] ?? "docs/vm_master_table/vm_master_table_simp.csv";

async function main(): Promise<void> {
  const rows = await readVmMasterCsv(csvPath);
  const database = openVmMasterDatabase();

  try {
    applyVmMasterSchema(database);
    importVmMasterRows(database, rows);
  } finally {
    database.close();
  }

  console.log(`Imported ${rows.length} VM master assignments from ${csvPath}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

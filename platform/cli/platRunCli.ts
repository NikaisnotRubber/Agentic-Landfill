import path from "node:path";

import { createBatch, runBatchImportAndMap } from "../batch/batchService";
import { openMigratedPlatformDatabase } from "../db/database";
import { exportMappingCsv } from "../export/exportMappingCsv";
import { exportMappingXlsx } from "../export/exportMappingXlsx";
import type { BatchFileSet } from "../import/importBatchFiles";

function parseArgs(argv: string[]) {
  const dataDir = argv.find((arg) => arg.startsWith("--data-dir="))?.slice("--data-dir=".length);
  const output = argv.find((arg) => arg.startsWith("--output="))?.slice("--output=".length);
  const csvOutput = argv.find((arg) => arg.startsWith("--csv-output="))?.slice("--csv-output=".length);
  const batchId = argv.find((arg) => arg.startsWith("--batch="))?.slice("--batch=".length);

  if (!dataDir) {
    throw new Error("Missing --data-dir=<folder with 4 source files>");
  }

  return {
    dataDir: path.resolve(process.cwd(), dataDir),
    outputPath: output
      ? path.resolve(process.cwd(), output)
      : path.resolve(process.cwd(), "ad_user_vm_mapping.xlsx"),
    csvOutputPath: csvOutput ? path.resolve(process.cwd(), csvOutput) : undefined,
    batchId,
  };
}

function resolveBatchFiles(dataDir: string): BatchFileSet {
  const adGroups = path.join(dataDir, "groups_LTW_all.xlsx");
  const userRoles = path.join(dataDir, "User_Roles.csv");
  const users = path.join(dataDir, "Users.csv");
  const servers = path.join(dataDir, "Server_Profiles.csv");

  return {
    adGroupsXlsx: adGroups,
    userRolesCsv: userRoles,
    usersCsv: users,
    serverProfilesCsv: servers,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const db = openMigratedPlatformDatabase();
  const batchId = args.batchId ?? createBatch(db);
  const files = resolveBatchFiles(args.dataDir);

  console.log(`Batch ${batchId}: importing from ${args.dataDir}...`);
  const result = await runBatchImportAndMap(db, batchId, files);
  console.log(
    `Imported ad_members=${result.importCounts.adMembers} users=${result.importCounts.users} role_user=${result.importCounts.roleUsers} servers=${result.importCounts.servers}`,
  );
  console.log(`Mapped ${result.mappingRows} rows.`);

  const exported = await exportMappingXlsx({
    db,
    batchId,
    outputPath: args.outputPath,
  });
  console.log(`Wrote ${exported.outputPath} (${exported.rowCount} rows).`);

  if (args.csvOutputPath) {
    const csvExported = await exportMappingCsv({
      db,
      batchId,
      outputPath: args.csvOutputPath,
    });
    console.log(`Wrote ${csvExported.outputPath} (${csvExported.rowCount} rows).`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

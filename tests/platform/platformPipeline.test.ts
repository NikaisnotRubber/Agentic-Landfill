import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import ExcelJS from "exceljs";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { createBatch, runBatchImportAndMap } from "../../platform/batch/batchService";
import { loadMappingExportSchema } from "../../platform/contract/loadMappingExportSchema";
import { openMigratedPlatformDatabase, type PlatformDatabase } from "../../platform/db/database";
import { exportMappingCsv } from "../../platform/export/exportMappingCsv";
import { exportMappingXlsx } from "../../platform/export/exportMappingXlsx";
import { serializeMappingRow } from "../../platform/export/serializeMappingRow";
import { loadMappingRows } from "../../platform/mapping/materializeMappingRows";

const FIXTURE_DIR = path.resolve("tests/fixtures/platform-batch");
const DB_PATH = path.resolve("tests/fixtures/platform-batch/test.db");

let db: PlatformDatabase;

async function writeMinimalAdGroupsXlsx(filePath: string) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("IT");
  sheet.addRow(["群組", "AD Account", "CN", "Mail", "BU", "BG"]);
  sheet.addRow(["L-TW-EXAMPLE", "LEO.ZOU", "鄒小明", "leo.zou@deltaww.com", "IT", "ITBG"]);
  await workbook.xlsx.writeFile(filePath);
}

beforeAll(async () => {
  await mkdir(FIXTURE_DIR, { recursive: true });
  await writeMinimalAdGroupsXlsx(path.join(FIXTURE_DIR, "groups_LTW_all.xlsx"));

  await writeFile(
    path.join(FIXTURE_DIR, "User_Roles.csv"),
    "Customer,Project,Role,User,Application(Server Group)/Service/MSG Device Group,Access Policies\nDelta,Test,MGR_ROLE_A,LEO.ZOU,,1\n",
  );
  await writeFile(
    path.join(FIXTURE_DIR, "Users.csv"),
    "Customer,Project,Account,FirstName,LastName,Mail,Application\nDelta,Test,LEO.ZOU,小明,鄒,leo.zou@deltaww.com,Digital Design Platform\n",
  );
  await writeFile(
    path.join(FIXTURE_DIR, "Server_Profiles.csv"),
    `Hostname,Customer,App Profile,Application(Server Group),Server Function,zLink Version,Online Since,Online Since (UTC+08:00),Host IP,Public IP,CoIP Address
TWPJOTHER,Delta,,MGR_ROLE_A,,,,,10.1.2.3,,
`,
  );

  db = openMigratedPlatformDatabase(DB_PATH);
});

afterEach(() => {
  db.prepare(`DELETE FROM mapping_row`).run();
  db.prepare(`DELETE FROM raw_ad_members`).run();
  db.prepare(`DELETE FROM raw_users`).run();
  db.prepare(`DELETE FROM raw_role_user`).run();
  db.prepare(`DELETE FROM raw_servers`).run();
  db.prepare(`DELETE FROM batch_files`).run();
  db.prepare(`DELETE FROM batches`).run();
});

describe("platform pipeline", () => {
  it("imports, maps, and exports aligned rows", async () => {
    const batchId = createBatch(db);
    const result = await runBatchImportAndMap(db, batchId, {
      adGroupsXlsx: path.join(FIXTURE_DIR, "groups_LTW_all.xlsx"),
      userRolesCsv: path.join(FIXTURE_DIR, "User_Roles.csv"),
      usersCsv: path.join(FIXTURE_DIR, "Users.csv"),
      serverProfilesCsv: path.join(FIXTURE_DIR, "Server_Profiles.csv"),
    });

    expect(result.mappingRows).toBeGreaterThan(0);

    const rows = loadMappingRows(db, batchId);
    expect(rows[0]?.ad_account).toBe("LEO.ZOU");
    expect(rows[0]?.vm_hostname).toBe("TWPJOTHER");

    const schema = await loadMappingExportSchema();
    const serialized = serializeMappingRow(rows[0], schema);
    expect(serialized[schema.columns.findIndex((c) => c.excelHeader === "Host IP")]).toBe(
      "10.1.2.3",
    );

    const outPath = path.join(FIXTURE_DIR, "out.xlsx");
    const exported = await exportMappingXlsx({ db, batchId, outputPath: outPath });
    expect(exported.rowCount).toBe(result.mappingRows);

    const csvPath = path.join(FIXTURE_DIR, "out.csv");
    const csvExported = await exportMappingCsv({ db, batchId, outputPath: csvPath });
    expect(csvExported.rowCount).toBe(result.mappingRows);
  });

  it("excludes notebook EXCLUDE_GROUPS", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("IT");
    sheet.addRow(["群組", "AD Account", "CN", "Mail", "BU", "BG"]);
    sheet.addRow([
      "L-TW-SSLVPN",
      "LEO.ZOU",
      "鄒小明",
      "leo.zou@deltaww.com",
      "IT",
      "ITBG",
    ]);
    const xlsxPath = path.join(FIXTURE_DIR, "groups_excluded.xlsx");
    await workbook.xlsx.writeFile(xlsxPath);

    const batchId = createBatch(db);
    const result = await runBatchImportAndMap(db, batchId, {
      adGroupsXlsx: xlsxPath,
      userRolesCsv: path.join(FIXTURE_DIR, "User_Roles.csv"),
      usersCsv: path.join(FIXTURE_DIR, "Users.csv"),
      serverProfilesCsv: path.join(FIXTURE_DIR, "Server_Profiles.csv"),
    });

    expect(result.mappingRows).toBe(0);
  });
});

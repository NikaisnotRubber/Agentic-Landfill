import { describe, expect, it } from "vitest";

import { createBatch, runBatchImportAndMap } from "../../platform/batch/batchService";
import { openMigratedPlatformDatabase } from "../../platform/db/database";
import { lookupPublishedMappingRow } from "../../platform/lookup/lookupPublishedMappingRow";
import path from "node:path";

const FIXTURE_DIR = path.resolve("tests/fixtures/platform-batch");
const DB_PATH = path.resolve("tests/fixtures/platform-batch/lookup-test.db");

describe("lookupPublishedMappingRow integration", () => {
  it("loads published platform DB rows for account and VM lookups", async () => {
    process.env.DATABASE_URL = `file:${DB_PATH}`;
    const db = openMigratedPlatformDatabase(DB_PATH);
    const batchId = createBatch(db);
    await runBatchImportAndMap(db, batchId, {
      adGroupsXlsx: path.join(FIXTURE_DIR, "groups_LTW_all.xlsx"),
      userRolesCsv: path.join(FIXTURE_DIR, "User_Roles.csv"),
      usersCsv: path.join(FIXTURE_DIR, "Users.csv"),
      serverProfilesCsv: path.join(FIXTURE_DIR, "Server_Profiles.csv"),
    });

    const fields = lookupPublishedMappingRow(db, "LEO.ZOU", "TWPJOTHER");

    expect(fields?.application).toBe("Digital Design Platform");
    expect(fields?.userRoles).toBe("MGR_ROLE_A");

    db.close();
  });
});

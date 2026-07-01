import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createBatch, runBatchImportAndMap } from "../../platform/batch/batchService";
import { openMigratedPlatformDatabase } from "../../platform/db/database";
import { lookupPublishedMappingRow } from "../../platform/lookup/lookupPublishedMappingRow";
import { upsertMappingFromProcessedRows } from "../../platform/sync/upsertMappingFromProcessed";
import type { ProcessedDdpRow } from "../../server/ddp/types";

const FIXTURE_DIR = path.resolve("tests/fixtures/platform-batch");
const DB_PATH = path.resolve("tests/fixtures/platform-batch/lookup-priority-test.db");

async function seedPublishedBatch(db: ReturnType<typeof openMigratedPlatformDatabase>): Promise<void> {
  const batchId = createBatch(db);
  await runBatchImportAndMap(db, batchId, {
    adGroupsXlsx: path.join(FIXTURE_DIR, "groups_LTW_all.xlsx"),
    userRolesCsv: path.join(FIXTURE_DIR, "User_Roles.csv"),
    usersCsv: path.join(FIXTURE_DIR, "Users.csv"),
    serverProfilesCsv: path.join(FIXTURE_DIR, "Server_Profiles.csv"),
  });
}

function ticketRow(): ProcessedDdpRow {
  return {
    ticketId: "900001",
    status: "Open",
    subject: "[DDP] priority test",
    requester: "LEO.ZOU",
    isNewTicket: true,
    adAccount: "LEO.ZOU",
    adName: "鄒皓年",
    firstName: "LEO",
    lastName: "ZOU",
    mail: "LEO.ZOU@DELTAWW.COM",
    bu: "BU-TICKET",
    nbHostname: "TWCL1NB9999",
    vmHostname: "TWPJOTHER",
    role: "ROLE-TICKET",
    application: "Application From Ticket",
    userRoles: "TICKET_ROLE_ONLY",
    abnormalFlags: [],
  };
}

describe("lookupPublishedMappingRow ticket priority", () => {
  afterEach(() => {
    delete process.env.DATABASE_URL;
  });

  it("prefers ticket mapping_row over batch row for the same account and vm", async () => {
    process.env.DATABASE_URL = `file:${DB_PATH}`;
    const db = openMigratedPlatformDatabase(DB_PATH);
    await seedPublishedBatch(db);
    upsertMappingFromProcessedRows(db, [ticketRow()]);

    const lookup = lookupPublishedMappingRow(db, "LEO.ZOU", "TWPJOTHER");
    expect(lookup?.application).toBe("Application From Ticket");
    expect(lookup?.userRoles).toBe("TICKET_ROLE_ONLY");
    expect(lookup?.role).toBe("ROLE-TICKET");

    db.close();
  });
});

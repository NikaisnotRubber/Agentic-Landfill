import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import ExcelJS from "exceljs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  getLiveTicketSyncStatus,
  getPublishedBatchMetadata,
  queryPublishedMappingRows,
} from "../../platform/api/publishedMappingService";
import { createBatch, runBatchImportAndMap } from "../../platform/batch/batchService";
import { openMigratedPlatformDatabase, type PlatformDatabase } from "../../platform/db/database";
import { LIVE_TICKET_BATCH_ID } from "../../platform/sync/constants";
import { upsertMappingFromProcessedRows } from "../../platform/sync/upsertMappingFromProcessed";
import type { ProcessedDdpRow } from "../../server/ddp/types";

const FIXTURE_DIR = path.resolve("tests/fixtures/platform-api");
const DB_PATH = path.resolve("tests/fixtures/platform-api/test.db");

let db: PlatformDatabase;
const originalDatabaseUrl = process.env.DATABASE_URL;

async function writeMinimalBatchFiles(dir: string) {
  await mkdir(dir, { recursive: true });
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("IT");
  sheet.addRow(["蝢斤?", "AD Account", "CN", "Mail", "BU", "BG"]);
  sheet.addRow(["L-TW-EXAMPLE", "LEO.ZOU", "Leo Zou", "leo.zou@deltaww.com", "IT", "ITBG"]);
  sheet.getCell("A1").value = "Group";
  await workbook.xlsx.writeFile(path.join(dir, "groups_LTW_all.xlsx"));

  await writeFile(
    path.join(dir, "User_Roles.csv"),
    "Customer,Project,Role,User\nDelta,Test,MGR_ROLE_A,LEO.ZOU\n",
  );
  await writeFile(
    path.join(dir, "Users.csv"),
    "Customer,Project,Account,FirstName,LastName,Mail,Application\nDelta,Test,LEO.ZOU,Leo,Zou,leo.zou@deltaww.com,Digital Design Platform\n",
  );
  await writeFile(
    path.join(dir, "Server_Profiles.csv"),
    "Hostname,Application(Server Group),Host IP\nTWPJOTHER,MGR_ROLE_A,10.1.2.3\n",
  );
}

function sampleProcessedRow(overrides: Partial<ProcessedDdpRow> = {}): ProcessedDdpRow {
  return {
    ticketId: "822184",
    status: "Open",
    subject: "[DDP] test",
    requester: "LEO.ZOU",
    isNewTicket: true,
    adAccount: "LEO.ZOU",
    adName: "Leo Zou",
    firstName: "Leo",
    lastName: "Zou",
    mail: "leo.zou@deltaww.com",
    bu: "IT",
    nbHostname: "TWCL1NB5308",
    vmHostname: "TWPJRDPSCNLT05",
    role: "",
    application: "Digital Design Platform",
    userRoles: "MGR_ROLE_A",
    abnormalFlags: [],
    ...overrides,
  };
}

beforeAll(async () => {
  process.env.DATABASE_URL = `file:${DB_PATH}`;
  await rm(DB_PATH, { force: true });
  await writeMinimalBatchFiles(FIXTURE_DIR);
  db = openMigratedPlatformDatabase(DB_PATH);
  const batchId = createBatch(db);
  await runBatchImportAndMap(db, batchId, {
    adGroupsXlsx: path.join(FIXTURE_DIR, "groups_LTW_all.xlsx"),
    userRolesCsv: path.join(FIXTURE_DIR, "User_Roles.csv"),
    usersCsv: path.join(FIXTURE_DIR, "Users.csv"),
    serverProfilesCsv: path.join(FIXTURE_DIR, "Server_Profiles.csv"),
  });
});

afterAll(() => {
  db.close();
  if (originalDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = originalDatabaseUrl;
  }
});

describe("publishedMappingService", () => {
  it("returns published batch metadata", () => {
    const metadata = getPublishedBatchMetadata(db);
    expect(metadata?.status).toBe("published");
    expect(metadata?.rowCount).toBeGreaterThan(0);
  });

  it("queries rows by ad account with export headers", async () => {
    const result = await queryPublishedMappingRows(db, { adAccount: "LEO.ZOU", limit: 10 });
    expect(result?.rows[0]?.["AD Account"]).toBe("LEO.ZOU");
    expect(result?.rows[0]?.["VM HostName"]).toBe("TWPJOTHER");
    expect(result?.rows[0]?.["FirstName"]).toBe("Leo");
    expect(result?.rows[0]?.["LastName"]).toBe("Zou");
  });

  it("returns live ticket sync status", () => {
    upsertMappingFromProcessedRows(db, [sampleProcessedRow()]);

    const status = getLiveTicketSyncStatus(db);
    expect(status.batchId).toBe(LIVE_TICKET_BATCH_ID);
    expect(status.rowCount).toBeGreaterThan(0);
    expect(status.lastUpdatedAt).toEqual(expect.any(String));
    expect(status.platformSyncTicketsEnabled).toBe(true);
  });
});

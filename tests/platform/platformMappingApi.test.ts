import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import ExcelJS from "exceljs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  getPublishedBatchMetadata,
  queryPublishedMappingRows,
} from "../../platform/api/publishedMappingService";
import { createBatch, runBatchImportAndMap } from "../../platform/batch/batchService";
import { openMigratedPlatformDatabase, type PlatformDatabase } from "../../platform/db/database";
import { registerPlatformMappingRoutes } from "../../server/platformMappingApiPlugin";

const FIXTURE_DIR = path.resolve("tests/fixtures/platform-api");
const DB_PATH = path.resolve("tests/fixtures/platform-api/test.db");

let db: PlatformDatabase;
const originalDatabaseUrl = process.env.DATABASE_URL;

async function writeMinimalBatchFiles(dir: string) {
  await mkdir(dir, { recursive: true });
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("IT");
  sheet.addRow(["群組", "AD Account", "CN", "Mail", "BU", "BG"]);
  sheet.addRow(["L-TW-EXAMPLE", "LEO.ZOU", "鄒小明", "leo.zou@deltaww.com", "IT", "ITBG"]);
  await workbook.xlsx.writeFile(path.join(dir, "groups_LTW_all.xlsx"));

  await writeFile(
    path.join(dir, "User_Roles.csv"),
    "Customer,Project,Role,User\nDelta,Test,MGR_ROLE_A,LEO.ZOU\n",
  );
  await writeFile(
    path.join(dir, "Users.csv"),
    "Customer,Project,Account,FirstName,LastName,Mail,Application\nDelta,Test,LEO.ZOU,小明,鄒,leo.zou@deltaww.com,Digital Design Platform\n",
  );
  await writeFile(
    path.join(dir, "Server_Profiles.csv"),
    "Hostname,Application(Server Group),Host IP\nTWPJOTHER,MGR_ROLE_A,10.1.2.3\n",
  );
}

function createMockResponse() {
  return {
    statusCode: 200,
    body: "",
    setHeader() {},
    end(payload: string) {
      this.body = payload;
    },
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
  process.env.DATABASE_URL = originalDatabaseUrl;
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
    expect(result?.rows[0]?.["FirstName"]).toBe("鄒");
    expect(result?.rows[0]?.["LastName"]).toBe("小明");
  });
});

describe("platform mapping API routes", () => {
  it("GET /api/platform/mapping/published returns metadata", async () => {
    const middlewares = { use: vi.fn() };
    registerPlatformMappingRoutes(middlewares);
    const handler = middlewares.use.mock.calls.find(
      ([route]) => route === "/api/platform/mapping/published",
    )?.[1];
    expect(handler).toBeDefined();

    const response = createMockResponse();
    await handler!({ method: "GET", url: "/api/platform/mapping/published" } as never, response as never);
    const payload = JSON.parse(response.body) as { ok: boolean; rowCount: number };
    expect(payload.ok).toBe(true);
    expect(payload.rowCount).toBeGreaterThan(0);
  });
});

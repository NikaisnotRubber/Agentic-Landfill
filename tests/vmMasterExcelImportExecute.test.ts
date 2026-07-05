import { rm } from "node:fs/promises";
import path from "node:path";

import ExcelJS from "exceljs";
import { afterEach, describe, expect, it } from "vitest";

import type { AdLookupClient } from "../server/ad/ldapClient";
import { applyVmMasterSchema, openVmMasterDatabase, type VmMasterDatabase } from "../server/db/sqlite";
import { executeVmMasterExcelImport } from "../server/vmMaster/excelImport";
import { readHelpdeskVmSyncLog } from "../server/vmMaster/syncLog";

const LOG_DIR = path.resolve("tests/fixtures/vm-master-excel-import-logs");

let database: VmMasterDatabase | undefined;

async function workbookBuffer(headers: string[], rows: unknown[][]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Import");
  sheet.addRow(headers);
  for (const row of rows) {
    sheet.addRow(row);
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function multiSheetWorkbookBuffer(
  sheets: Array<{ name: string; headers: string[]; rows: unknown[][] }>,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  for (const input of sheets) {
    const sheet = workbook.addWorksheet(input.name);
    sheet.addRow(input.headers);
    for (const row of input.rows) {
      sheet.addRow(row);
    }
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function createLookupClient(): AdLookupClient {
  return {
    async lookupUser(account) {
      if (account === "CHUNKAI.LIU") {
        return {
          adAccount: "CHUNKAI.LIU",
          displayName: "Chunkai Liu",
          mail: "chunkai.liu@example.test",
          department: "DDP",
          manager: "Leo Zou",
          managerDn: "CN=Leo Zou,OU=Users,DC=example,DC=test",
          employeeId: "T12345",
          bg: "DBG",
          bu: "DDP",
        };
      }
      if (account === "EXPLICIT.USER") {
        return {
          adAccount: "EXPLICIT.USER",
          displayName: "Explicit User",
          mail: "explicit.user@example.test",
          department: "OPS",
          manager: "",
          managerDn: "",
          employeeId: "",
          bg: "DBG",
          bu: "OPS",
        };
      }
      return null;
    },
    async lookupManagerAccount(managerDn) {
      return managerDn ? { adAccount: "LEO.ZOU", displayName: "Leo Zou" } : null;
    },
    async close() {},
  };
}

function seedDb(): VmMasterDatabase {
  database = openVmMasterDatabase(":memory:");
  applyVmMasterSchema(database);
  database
    .prepare(
      "INSERT INTO vm_users (ad_name, chn_name, email_address, bg, bu, report_to) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run("LEO.ZOU", "Leo Zou", "leo.zou@example.test", "DBG", "DDP", "");
  database.prepare("INSERT INTO vm_machines (vm_name) VALUES (?)").run("TWPJDDP01");
  database
    .prepare(
      "INSERT INTO vm_user_vm_assignments (ad_name, vm_name, group_name, zentera_role) VALUES (?, ?, ?, ?)",
    )
    .run("LEO.ZOU", "TWPJDDP01", "DDP_USERS", "DDP_USER");
  database.prepare("INSERT INTO vm_machines (vm_name) VALUES (?)").run("TWPJOPS01");
  database
    .prepare(
      "INSERT INTO vm_user_vm_assignments (ad_name, vm_name, group_name, zentera_role) VALUES (?, ?, ?, ?)",
    )
    .run("LEO.ZOU", "TWPJOPS01", "OPS_USERS", "OPS_USER");
  return database;
}

afterEach(async () => {
  database?.close();
  database = undefined;
  await rm(LOG_DIR, { recursive: true, force: true });
});

describe("executeVmMasterExcelImport", () => {
  it("enriches from AD and infers assignments from the manager", async () => {
    const db = seedDb();
    const buffer = await workbookBuffer(["AD_NAME"], [["CHUNKAI.LIU"]]);

    const result = await executeVmMasterExcelImport(
      {
        fileName: "vm-master.xlsx",
        workbookBuffer: buffer,
        mapping: { AD_NAME: "AD_NAME" },
      },
      {
        database: db,
        createLookupClient,
        startedAt: "2026-07-01T01:00:00.000Z",
        logDir: LOG_DIR,
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.summary).toMatchObject({
      rowCount: 1,
      importedRowCount: 1,
      failedRowCount: 0,
      managerInferredAssignmentCount: 2,
      explicitAssignmentCount: 0,
      adEnrichedCount: 1,
    });
    expect(
      db
        .prepare("SELECT ad_name, email_address, report_to FROM vm_users WHERE ad_name = ?")
        .get("CHUNKAI.LIU"),
    ).toEqual({
      ad_name: "CHUNKAI.LIU",
      email_address: "chunkai.liu@example.test",
      report_to: "LEO.ZOU",
    });
    expect(
      db
        .prepare(
          "SELECT vm_name, group_name, zentera_role FROM vm_user_vm_assignments WHERE ad_name = ? ORDER BY vm_name",
        )
        .all("CHUNKAI.LIU"),
    ).toEqual([
      { vm_name: "TWPJDDP01", group_name: "DDP_USERS", zentera_role: "DDP_USER" },
      { vm_name: "TWPJOPS01", group_name: "OPS_USERS", zentera_role: "OPS_USER" },
    ]);

    const log = await readHelpdeskVmSyncLog(result.summary.logId ?? "", { logDir: LOG_DIR });
    expect(log.kind).toBe("excel-import");
    expect(log.requestSummary).toMatchObject({
      fileName: "vm-master.xlsx",
      worksheetName: "Import",
      excelRowCount: 1,
      mappedColumnCount: 1,
      mappedFields: ["AD_NAME"],
    });
  });

  it("imports every worksheet and persists mapped worksheet names", async () => {
    const db = seedDb();
    const buffer = await multiSheetWorkbookBuffer([
      {
        name: "DDP",
        headers: ["AD_NAME", "VM_NAME", "GROUP_NAME", "ZENTERA_ROLE"],
        rows: [["EXPLICIT.USER", "TWPJNEW01", "DDP_GROUP", "DDP_ROLE"]],
      },
      {
        name: "OPS",
        headers: ["AD_NAME", "VM_NAME"],
        rows: [["CHUNKAI.LIU", "TWPJOPS02"]],
      },
    ]);

    const result = await executeVmMasterExcelImport(
      {
        fileName: "vm-master.xlsx",
        workbookBuffer: buffer,
        mapping: {
          AD_NAME: "AD_NAME",
          VM_NAME: "VM_NAME",
          GROUP_NAME: "GROUP_NAME",
          ZENTERA_ROLE: "ZENTERA_ROLE",
          WORK_SHEET: "WORK_SHEET",
        },
      },
      {
        database: db,
        createLookupClient,
        startedAt: "2026-07-01T01:00:00.000Z",
        logDir: LOG_DIR,
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.summary).toMatchObject({
      rowCount: 2,
      importedRowCount: 2,
      explicitAssignmentCount: 2,
    });
    expect(
      db
        .prepare(
          `SELECT ad_name, vm_name, work_sheet
           FROM vm_user_vm_assignments
           WHERE ad_name IN ('CHUNKAI.LIU', 'EXPLICIT.USER')
           ORDER BY ad_name`,
        )
        .all(),
    ).toEqual([
      { ad_name: "CHUNKAI.LIU", vm_name: "TWPJOPS02", work_sheet: "OPS" },
      { ad_name: "EXPLICIT.USER", vm_name: "TWPJNEW01", work_sheet: "DDP" },
    ]);

    const log = await readHelpdeskVmSyncLog(result.summary.logId ?? "", { logDir: LOG_DIR });
    expect(log.requestSummary).toMatchObject({
      worksheetName: "DDP, OPS",
      excelRowCount: 2,
      mappedFields: expect.arrayContaining(["WORK_SHEET"]),
      rows: [
        { worksheetName: "DDP", rowNumber: 2, adName: "EXPLICIT.USER", vmName: "TWPJNEW01" },
        { worksheetName: "OPS", rowNumber: 2, adName: "CHUNKAI.LIU", vmName: "TWPJOPS02" },
      ],
    });
  });

  it("reuses AD and manager lookups for repeated workbook rows", async () => {
    const db = seedDb();
    const buffer = await workbookBuffer(["AD_NAME"], [["CHUNKAI.LIU"], ["CHUNKAI.LIU"]]);
    let userLookupCount = 0;
    let managerLookupCount = 0;

    const createCountingLookupClient = (): AdLookupClient => {
      const base = createLookupClient();
      return {
        async lookupUser(account) {
          userLookupCount += 1;
          return base.lookupUser(account);
        },
        async lookupManagerAccount(managerDn) {
          managerLookupCount += 1;
          return base.lookupManagerAccount(managerDn);
        },
        async close() {},
      };
    };

    const result = await executeVmMasterExcelImport(
      {
        fileName: "vm-master.xlsx",
        workbookBuffer: buffer,
        mapping: { AD_NAME: "AD_NAME" },
      },
      {
        database: db,
        createLookupClient: createCountingLookupClient,
        startedAt: "2026-07-01T01:00:00.000Z",
        logDir: LOG_DIR,
      },
    );

    expect(result.ok).toBe(true);
    expect(userLookupCount).toBe(1);
    expect(managerLookupCount).toBe(1);
  });

  it("uses explicit VM_NAME and continues after failed rows", async () => {
    const db = seedDb();
    const buffer = await workbookBuffer(
      ["AD_NAME", "VM_NAME", "GROUP_NAME", "ZENTERA_ROLE"],
      [
        ["EXPLICIT.USER", "TWPJNEW01", "NEW_GROUP", "NEW_ROLE"],
        ["MISSING.USER", "", "", ""],
      ],
    );

    const result = await executeVmMasterExcelImport(
      {
        fileName: "vm-master.xlsx",
        workbookBuffer: buffer,
        mapping: {
          AD_NAME: "AD_NAME",
          VM_NAME: "VM_NAME",
          GROUP_NAME: "GROUP_NAME",
          ZENTERA_ROLE: "ZENTERA_ROLE",
        },
      },
      {
        database: db,
        createLookupClient,
        startedAt: "2026-07-01T01:00:00.000Z",
        logDir: LOG_DIR,
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.summary).toMatchObject({
      rowCount: 2,
      importedRowCount: 1,
      failedRowCount: 1,
      explicitAssignmentCount: 1,
    });
    expect(result.summary.warnings[0]).toMatchObject({
      rowNumber: 3,
      stage: "ad-enrichment",
      code: "user-not-found",
      adName: "MISSING.USER",
    });
    expect(
      db
        .prepare(
          "SELECT vm_name, group_name, zentera_role FROM vm_user_vm_assignments WHERE ad_name = ?",
        )
        .get("EXPLICIT.USER"),
    ).toEqual({ vm_name: "TWPJNEW01", group_name: "NEW_GROUP", zentera_role: "NEW_ROLE" });
  });
  it("falls back when manager account lookup fails", async () => {
    const db = seedDb();
    const buffer = await workbookBuffer(["AD_NAME"], [["CHUNKAI.LIU"]]);
    const createFallbackLookupClient = (): AdLookupClient => ({
      ...createLookupClient(),
      async lookupManagerAccount() {
        throw new Error("manager lookup unavailable");
      },
    });

    const result = await executeVmMasterExcelImport(
      {
        fileName: "vm-master.xlsx",
        workbookBuffer: buffer,
        mapping: { AD_NAME: "AD_NAME" },
      },
      {
        database: db,
        createLookupClient: createFallbackLookupClient,
        startedAt: "2026-07-01T01:00:00.000Z",
        logDir: LOG_DIR,
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.summary.importedRowCount).toBe(1);
    expect(result.summary.warnings[0]).toMatchObject({
      rowNumber: 2,
      stage: "ad-enrichment",
      code: "manager-account-lookup-failed",
      adName: "CHUNKAI.LIU",
    });
  });

  it("returns a failed execution record when workbook parsing fails", async () => {
    const db = seedDb();
    const buffer = await workbookBuffer(["AD_NAME"], []);

    const result = await executeVmMasterExcelImport(
      {
        fileName: "empty.xlsx",
        workbookBuffer: buffer,
        mapping: { AD_NAME: "AD_NAME" },
      },
      {
        database: db,
        createLookupClient,
        startedAt: "2026-07-01T01:00:00.000Z",
        logDir: LOG_DIR,
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error).toBe("VM Master Excel import requires at least one data row");
    expect(result.logId).toBeTruthy();
    const log = await readHelpdeskVmSyncLog(result.logId ?? "", { logDir: LOG_DIR });
    expect(log).toMatchObject({
      kind: "excel-import",
      ok: false,
      error: "VM Master Excel import requires at least one data row",
    });
  });
  it("rolls back user data when VM inference fails", async () => {
    const db = seedDb();
    const buffer = await workbookBuffer(
      ["AD_NAME", "REPORT_TO"],
      [["CHUNKAI.LIU", "UNKNOWN.MANAGER"]],
    );

    const result = await executeVmMasterExcelImport(
      {
        fileName: "vm-master.xlsx",
        workbookBuffer: buffer,
        mapping: { AD_NAME: "AD_NAME", REPORT_TO: "REPORT_TO" },
      },
      {
        database: db,
        createLookupClient,
        startedAt: "2026-07-01T01:00:00.000Z",
        logDir: LOG_DIR,
      },
    );

    expect(result.ok).toBe(false);
    expect(
      db.prepare("SELECT ad_name FROM vm_users WHERE ad_name = ?").get("CHUNKAI.LIU"),
    ).toBeUndefined();
  });

  it("uses existing DB user data when AD lookup misses", async () => {
    const db = seedDb();
    db.prepare(
      "INSERT INTO vm_users (ad_name, chn_name, email_address, bg, bu, user_role, user_dept, report_to) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).run("EXISTING.USER", "Existing User", "existing.user@example.test", "DBG", "DDP", "Engineer", "DDP", "LEO.ZOU");
    const buffer = await workbookBuffer(["AD_NAME"], [["EXISTING.USER"]]);

    const result = await executeVmMasterExcelImport(
      {
        fileName: "vm-master.xlsx",
        workbookBuffer: buffer,
        mapping: { AD_NAME: "AD_NAME" },
      },
      {
        database: db,
        createLookupClient,
        startedAt: "2026-07-01T01:00:00.000Z",
        logDir: LOG_DIR,
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.summary).toMatchObject({
      importedRowCount: 1,
      failedRowCount: 0,
      dbFilledCount: 1,
      managerInferredAssignmentCount: 2,
    });
    expect(result.summary.warnings[0]).toMatchObject({
      rowNumber: 2,
      stage: "ad-enrichment",
      code: "user-not-found",
      adName: "EXISTING.USER",
    });
    expect(
      db
        .prepare("SELECT vm_name FROM vm_user_vm_assignments WHERE ad_name = ? ORDER BY vm_name")
        .all("EXISTING.USER"),
    ).toEqual([{ vm_name: "TWPJDDP01" }, { vm_name: "TWPJOPS01" }]);
  });

  it("persists mapped current BG/BU and max online users", async () => {
    const db = seedDb();
    const buffer = await workbookBuffer(
      ["AD_NAME", "VM_NAME", "GROUP_NAME", "ZENTERA_ROLE", "MAX_ONLINE_USERS", "BU_CURR", "BG_CURR"],
      [["EXPLICIT.USER", "TWPJMAX01", "MAX_GROUP", "MAX_ROLE", 7, "OPS-CURRENT", "DBG-CURRENT"]],
    );

    const result = await executeVmMasterExcelImport(
      {
        fileName: "vm-master.xlsx",
        workbookBuffer: buffer,
        mapping: {
          AD_NAME: "AD_NAME",
          VM_NAME: "VM_NAME",
          GROUP_NAME: "GROUP_NAME",
          ZENTERA_ROLE: "ZENTERA_ROLE",
          MAX_ONLINE_USERS: "MAX_ONLINE_USERS",
          BU_CURR: "BU_CURR",
          BG_CURR: "BG_CURR",
        },
      },
      {
        database: db,
        createLookupClient,
        startedAt: "2026-07-01T01:00:00.000Z",
        logDir: LOG_DIR,
      },
    );

    expect(result.ok).toBe(true);
    expect(
      db.prepare("SELECT bu_curr, bg_curr FROM vm_users WHERE ad_name = ?").get("EXPLICIT.USER"),
    ).toEqual({ bu_curr: "OPS-CURRENT", bg_curr: "DBG-CURRENT" });
    expect(
      db.prepare("SELECT max_online_users FROM vm_machines WHERE vm_name = ?").get("TWPJMAX01"),
    ).toEqual({ max_online_users: 7 });
  });

  it("returns a failed execution record when lookup client creation fails", async () => {
    const db = seedDb();
    const buffer = await workbookBuffer(["AD_NAME"], [["CHUNKAI.LIU"]]);

    const result = await executeVmMasterExcelImport(
      {
        fileName: "vm-master.xlsx",
        workbookBuffer: buffer,
        mapping: { AD_NAME: "AD_NAME" },
      },
      {
        database: db,
        createLookupClient: () => {
          throw new Error("AD client unavailable");
        },
        startedAt: "2026-07-01T01:00:00.000Z",
        logDir: LOG_DIR,
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error).toBe("AD client unavailable");
    expect(result.logId).toBeTruthy();
    const log = await readHelpdeskVmSyncLog(result.logId ?? "", { logDir: LOG_DIR });
    expect(log).toMatchObject({ kind: "excel-import", ok: false, error: "AD client unavailable" });
  });
});

# VM Master Excel Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add VM Master Excel upload/import to the current VM Master Preview flow, with one-to-one field mapping, AD/DB enrichment, manager-based VM assignment inference, and execution-history summaries.

**Architecture:** Reuse the current VM Master SQLite repository and Helpdesk sync primitives. Add one focused backend import module, two JSON endpoints, a small client API/composable pair, and a mapping overlay in the existing VM Master page. Extend the existing JSON execution log shape instead of adding a second log system.

**Tech Stack:** TypeScript, Vue 3, Vite middleware, `node:sqlite`, `exceljs`, Vitest, `pnpm`.

---

## File Structure

- Create `server/vmMaster/excelImport.ts`: workbook parsing, default mapping, mapping validation, row import execution, row-level warnings.
- Create `server/vmMaster/excelImportRoute.ts`: JSON preview/execute endpoint handlers.
- Modify `server/vmMaster/types.ts`: shared Excel import types plus generic VM Master execution log types.
- Modify `server/vmMaster/syncLog.ts`: accept both `helpdesk-sync` and `excel-import`, default legacy logs to `helpdesk-sync`, keep existing filenames safe.
- Modify `server/vmMaster/helpdeskSync.ts`: include `kind: "helpdesk-sync"` and request-stage summaries in logs.
- Modify `vite.config.ts`: mount `/api/vm-master/import-excel/preview` and `/api/vm-master/import-excel/execute`.
- Modify `src/features/vm-master/types.ts`: mirror import and execution-log API result types.
- Modify `src/features/vm-master/api.ts`: add preview/execute import API calls.
- Create `src/features/vm-master/useVmMasterExcelImport.ts`: file read/base64, preview state, mapping state, execute state.
- Create `src/features/vm-master/excelImportMapping.ts`: pure helpers for one-to-one select disabling and default mapping updates.
- Modify `src/features/vm-master/VmMasterPreviewPage.vue`: add button, hidden file input, overlay card, import status, execution-history refresh.
- Modify `src/features/vm-master/useHelpdeskVmSyncLogs.ts`: type remains reusable for all VM Master execution logs.
- Modify `src/styles.css`: overlay/card/select layout.
- Add tests:
  - `tests/vmMasterExcelImportPreview.test.ts`
  - `tests/vmMasterExcelImportExecute.test.ts`
  - `tests/vmMasterExecutionLog.test.ts`
  - `tests/vmMasterExcelImportRoute.test.ts`
  - `tests/vmMasterExcelImportMapping.test.ts`
- Modify docs:
  - `docs/PROGRESS.md`
  - `docs/helpdesk-workflow.md`

---

### Task 1: Generalize VM Master Execution Logs

**Files:**
- Modify: `server/vmMaster/types.ts`
- Modify: `server/vmMaster/syncLog.ts`
- Modify: `server/vmMaster/helpdeskSync.ts`
- Test: `tests/vmMasterExecutionLog.test.ts`

- [ ] **Step 1: Write failing tests for generic execution logs**

Create `tests/vmMasterExecutionLog.test.ts`:

```ts
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  listHelpdeskVmSyncLogs,
  readHelpdeskVmSyncLog,
  writeHelpdeskVmSyncLog,
} from "../server/vmMaster/syncLog";
import type { VmMasterExecutionLogEntry } from "../server/vmMaster/types";

const LOG_DIR = path.resolve("tests/fixtures/vm-master-execution-logs");

describe("VM Master execution logs", () => {
  it("writes and reads an excel-import execution log with request summary", async () => {
    await rm(LOG_DIR, { recursive: true, force: true });

    const entry: Omit<VmMasterExecutionLogEntry, "id"> = {
      kind: "excel-import",
      startedAt: "2026-07-01T01:00:00.000Z",
      finishedAt: "2026-07-01T01:00:02.000Z",
      ok: true,
      options: {
        fileName: "vm-master.xlsx",
        worksheetName: "Sheet1",
        rowCount: 2,
        mappedFields: ["AD_NAME", "VM_NAME"],
      },
      requestSummary: {
        fileName: "vm-master.xlsx",
        worksheetName: "Sheet1",
        excelRowCount: 2,
        mappedColumnCount: 2,
        mappedFields: ["AD_NAME", "VM_NAME"],
        rows: [
          { rowNumber: 2, adName: "CHUNKAI.LIU", vmName: "TWPJDDP01" },
        ],
      },
      summary: {
        rowCount: 2,
        importedRowCount: 1,
        failedRowCount: 1,
        adEnrichedCount: 1,
        dbFilledCount: 0,
        managerInferredAssignmentCount: 0,
        explicitAssignmentCount: 1,
        warnings: [],
      },
      warnings: [],
      logs: ["2026-07-01 09:00:00,000 INFO imported 1 row"],
    };

    const { id } = await writeHelpdeskVmSyncLog(entry, { logDir: LOG_DIR });
    const readBack = await readHelpdeskVmSyncLog(id, { logDir: LOG_DIR });

    expect(readBack.kind).toBe("excel-import");
    expect(readBack.requestSummary).toMatchObject({
      fileName: "vm-master.xlsx",
      excelRowCount: 2,
      mappedColumnCount: 2,
    });
  });

  it("defaults legacy helpdesk logs to helpdesk-sync", async () => {
    await rm(LOG_DIR, { recursive: true, force: true });
    await mkdir(LOG_DIR, { recursive: true });
    const id = "helpdesk-vm-sync-20260701-090000-abc123";
    await writeFile(
      path.join(LOG_DIR, `${id}.json`),
      JSON.stringify({
        id,
        startedAt: "2026-07-01T01:00:00.000Z",
        finishedAt: "2026-07-01T01:00:01.000Z",
        ok: true,
        options: { count: 1 },
        summary: { warnings: [] },
        warnings: [],
        logs: [],
      }),
      "utf8",
    );

    const logs = await listHelpdeskVmSyncLogs({ logDir: LOG_DIR });
    const readBack = await readHelpdeskVmSyncLog(id, { logDir: LOG_DIR });

    expect(logs[0]).toMatchObject({ id, kind: "helpdesk-sync" });
    expect(readBack.kind).toBe("helpdesk-sync");
  });
});
```

- [ ] **Step 2: Run the failing log tests**

Run:

```bash
pnpm vitest run tests/vmMasterExecutionLog.test.ts
```

Expected: FAIL because `VmMasterExecutionLogEntry`, `kind`, and `requestSummary` are not defined yet.

- [ ] **Step 3: Add execution log types**

Modify `server/vmMaster/types.ts` by adding these types below `HelpdeskVmSyncResult` and replacing `HelpdeskVmSyncLogEntry` / `HelpdeskVmSyncLogListItem` with aliases to the generic types:

```ts
export type VmMasterExecutionKind = "helpdesk-sync" | "excel-import";

export type VmMasterHelpdeskSyncRequestSummary = {
  requestedTicketCount: number;
  fetchedTicketCount: number;
  parsedTicketCount: number;
  tickets: Array<{
    ticketId: string;
    requester: string;
    subject: string;
  }>;
};

export type VmMasterExcelImportRequestSummary = {
  fileName: string;
  worksheetName: string;
  excelRowCount: number;
  mappedColumnCount: number;
  mappedFields: string[];
  rows: Array<{
    rowNumber: number;
    adName: string;
    vmName?: string;
  }>;
};

export type VmMasterExecutionRequestSummary =
  | VmMasterHelpdeskSyncRequestSummary
  | VmMasterExcelImportRequestSummary;

export type VmMasterExcelImportSummary = {
  rowCount: number;
  importedRowCount: number;
  failedRowCount: number;
  adEnrichedCount: number;
  dbFilledCount: number;
  managerInferredAssignmentCount: number;
  explicitAssignmentCount: number;
  warnings: HelpdeskVmSyncWarning[];
  logId?: string;
  logPath?: string;
};

export type VmMasterExecutionSummary =
  | HelpdeskVmSyncSummary
  | VmMasterExcelImportSummary;

export type VmMasterExecutionOptions =
  | HelpdeskVmSyncOptions
  | {
      fileName: string;
      worksheetName: string;
      rowCount: number;
      mappedFields: string[];
    };

export type VmMasterExecutionLogEntry = {
  id: string;
  kind: VmMasterExecutionKind;
  startedAt: string;
  finishedAt: string;
  ok: boolean;
  options: VmMasterExecutionOptions;
  requestSummary?: VmMasterExecutionRequestSummary;
  summary: VmMasterExecutionSummary;
  warnings: HelpdeskVmSyncWarning[];
  logs: string[];
  error?: string;
};

export type VmMasterExecutionLogListItem = {
  id: string;
  kind: VmMasterExecutionKind;
  startedAt: string;
  finishedAt: string;
  ok: boolean;
  warningCount: number;
  logPath: string;
};

export type HelpdeskVmSyncLogEntry = VmMasterExecutionLogEntry;
export type HelpdeskVmSyncLogListItem = VmMasterExecutionLogListItem;
```

- [ ] **Step 4: Normalize legacy log reads**

Modify `server/vmMaster/syncLog.ts`:

```ts
function normalizeLogEntry(raw: unknown): HelpdeskVmSyncLogEntry {
  const entry = raw as HelpdeskVmSyncLogEntry & { kind?: HelpdeskVmSyncLogEntry["kind"] };
  return {
    ...entry,
    kind: entry.kind ?? "helpdesk-sync",
  };
}

function toListItem(entry: HelpdeskVmSyncLogEntry, logPath: string): HelpdeskVmSyncLogListItem {
  const normalized = normalizeLogEntry(entry);
  return {
    id: normalized.id,
    kind: normalized.kind,
    startedAt: normalized.startedAt,
    finishedAt: normalized.finishedAt,
    ok: normalized.ok,
    warningCount: normalized.warnings.length,
    logPath,
  };
}
```

Use `normalizeLogEntry(JSON.parse(...))` in `listHelpdeskVmSyncLogs()` and `readHelpdeskVmSyncLog()`.

- [ ] **Step 5: Add Helpdesk sync request summary**

Modify `server/vmMaster/helpdeskSync.ts` so the `writeHelpdeskVmSyncLog()` payload includes:

```ts
kind: "helpdesk-sync",
requestSummary: {
  requestedTicketCount: syncOptions.count,
  fetchedTicketCount: summary.fetchedTicketCount,
  parsedTicketCount: summary.parsedTicketCount,
  tickets: fetchResult.ok
    ? fetchResult.tickets.slice(0, 5).map((ticket) => ({
        ticketId: ticket.id,
        requester: ticket.requester,
        subject: ticket.subject,
      }))
    : [],
},
```

Keep the current `options`, `summary`, `warnings`, `logs`, and `error` fields.

- [ ] **Step 6: Run log tests**

Run:

```bash
pnpm vitest run tests/vmMasterExecutionLog.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add server/vmMaster/types.ts server/vmMaster/syncLog.ts server/vmMaster/helpdeskSync.ts tests/vmMasterExecutionLog.test.ts
git commit -m "feat(vm-master): generalize execution logs"
```

---

### Task 2: Excel Preview Parsing And Mapping Validation

**Files:**
- Create: `server/vmMaster/excelImport.ts`
- Test: `tests/vmMasterExcelImportPreview.test.ts`

- [ ] **Step 1: Write failing preview tests**

Create `tests/vmMasterExcelImportPreview.test.ts`:

```ts
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import {
  buildDefaultExcelImportMapping,
  parseVmMasterExcelPreview,
  validateVmMasterExcelMapping,
} from "../server/vmMaster/excelImport";

async function workbookBuffer(headers: string[], rows: unknown[][]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Import");
  sheet.addRow(headers);
  for (const row of rows) {
    sheet.addRow(row);
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe("VM Master Excel import preview", () => {
  it("extracts headers, row count, samples, importable fields, and default mapping", async () => {
    const buffer = await workbookBuffer(
      ["AD Name", "VM_NAME", "Report To", "Ignored"],
      [
        ["CHUNKAI.LIU", "TWPJDDP01", "LEO.ZOU", "x"],
        ["SUNGCHAO.SC.YU", "", "MANAGER.AD", "y"],
      ],
    );

    const preview = await parseVmMasterExcelPreview({
      fileName: "vm-master.xlsx",
      workbookBuffer: buffer,
    });

    expect(preview).toMatchObject({
      fileName: "vm-master.xlsx",
      worksheetName: "Import",
      headers: ["AD Name", "VM_NAME", "Report To", "Ignored"],
      rowCount: 2,
      defaultMapping: {
        "AD Name": "AD_NAME",
        VM_NAME: "VM_NAME",
        "Report To": "REPORT_TO",
      },
    });
    expect(preview.sampleRows).toEqual([
      {
        rowNumber: 2,
        values: {
          "AD Name": "CHUNKAI.LIU",
          VM_NAME: "TWPJDDP01",
          "Report To": "LEO.ZOU",
          Ignored: "x",
        },
      },
      {
        rowNumber: 3,
        values: {
          "AD Name": "SUNGCHAO.SC.YU",
          VM_NAME: "",
          "Report To": "MANAGER.AD",
          Ignored: "y",
        },
      },
    ]);
  });

  it("rejects duplicate target fields and missing AD_NAME", () => {
    expect(() =>
      validateVmMasterExcelMapping({
        Account: "AD_NAME",
        Duplicate: "AD_NAME",
      }),
    ).toThrow("Duplicate VM Master import target field: AD_NAME");

    expect(() =>
      validateVmMasterExcelMapping({
        VM: "VM_NAME",
      }),
    ).toThrow("VM Master Excel import requires an AD_NAME mapping");
  });

  it("builds defaults from normalized headers only", () => {
    expect(buildDefaultExcelImportMapping(["adName", "MAX ONLINE USERS", "No Match"])).toEqual({
      adName: "AD_NAME",
      "MAX ONLINE USERS": "MAX_ONLINE_USERS",
    });
  });
});
```

- [ ] **Step 2: Run the failing preview tests**

Run:

```bash
pnpm vitest run tests/vmMasterExcelImportPreview.test.ts
```

Expected: FAIL because `server/vmMaster/excelImport.ts` does not exist.

- [ ] **Step 3: Implement preview parsing and validation**

Create `server/vmMaster/excelImport.ts` with these exports and shapes:

```ts
import ExcelJS from "exceljs";

export const vmMasterExcelImportFields = [
  "AD_NAME",
  "CHN_NAME",
  "EMAIL_ADDRESS",
  "BG",
  "BU",
  "USER_ROLE",
  "GROUP_NAME",
  "VM_NAME",
  "MAX_ONLINE_USERS",
  "ZENTERA_ROLE",
  "USER_DEPT",
  "REPORT_TO",
  "BU_CURR",
  "BG_CURR",
] as const;

export type VmMasterExcelImportField = (typeof vmMasterExcelImportFields)[number];
export type VmMasterExcelImportMapping = Record<string, VmMasterExcelImportField>;

export type VmMasterExcelPreviewSampleRow = {
  rowNumber: number;
  values: Record<string, string>;
};

export type VmMasterExcelPreview = {
  fileName: string;
  worksheetName: string;
  headers: string[];
  rowCount: number;
  sampleRows: VmMasterExcelPreviewSampleRow[];
  importableFields: readonly VmMasterExcelImportField[];
  defaultMapping: Partial<Record<string, VmMasterExcelImportField>>;
};

function normalizeHeader(value: string): string {
  return value.trim().toUpperCase().replace(/[\s_-]+/g, "");
}

function stringifyCell(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && "text" in value) return String(value.text ?? "").trim();
  if (typeof value === "object" && "result" in value) return String(value.result ?? "").trim();
  return String(value).trim();
}

export function buildDefaultExcelImportMapping(
  headers: string[],
): Partial<Record<string, VmMasterExcelImportField>> {
  const fieldsByNormalized = new Map(
    vmMasterExcelImportFields.map((field) => [normalizeHeader(field), field]),
  );
  const mapping: Partial<Record<string, VmMasterExcelImportField>> = {};
  for (const header of headers) {
    const field = fieldsByNormalized.get(normalizeHeader(header));
    if (field) mapping[header] = field;
  }
  return mapping;
}

export function validateVmMasterExcelMapping(
  mapping: Partial<Record<string, string>>,
): VmMasterExcelImportMapping {
  const used = new Set<string>();
  const normalized: VmMasterExcelImportMapping = {};

  for (const [header, rawField] of Object.entries(mapping)) {
    if (!rawField) continue;
    if (!vmMasterExcelImportFields.includes(rawField as VmMasterExcelImportField)) {
      throw new Error(`Invalid VM Master import target field: ${rawField}`);
    }
    if (used.has(rawField)) {
      throw new Error(`Duplicate VM Master import target field: ${rawField}`);
    }
    used.add(rawField);
    normalized[header] = rawField as VmMasterExcelImportField;
  }

  if (![...used].includes("AD_NAME")) {
    throw new Error("VM Master Excel import requires an AD_NAME mapping");
  }

  return normalized;
}

export async function parseVmMasterExcelPreview(input: {
  fileName: string;
  workbookBuffer: Buffer;
}): Promise<VmMasterExcelPreview> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(input.workbookBuffer);
  const worksheet = workbook.worksheets.find((sheet) => sheet.actualRowCount > 1);
  if (!worksheet) throw new Error("VM Master Excel import requires a worksheet with headers and data");

  const headers = worksheet
    .getRow(1)
    .values.slice(1)
    .map((value) => stringifyCell(value as ExcelJS.CellValue))
    .filter(Boolean);
  if (headers.length === 0) throw new Error("VM Master Excel import requires header columns");

  const sampleRows: VmMasterExcelPreviewSampleRow[] = [];
  let rowCount = 0;
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values = Object.fromEntries(
      headers.map((header, index) => [header, stringifyCell(row.getCell(index + 1).value)]),
    );
    if (Object.values(values).every((value) => !value)) return;
    rowCount += 1;
    if (sampleRows.length < 5) sampleRows.push({ rowNumber, values });
  });
  if (rowCount === 0) throw new Error("VM Master Excel import requires at least one data row");

  return {
    fileName: input.fileName,
    worksheetName: worksheet.name,
    headers,
    rowCount,
    sampleRows,
    importableFields: vmMasterExcelImportFields,
    defaultMapping: buildDefaultExcelImportMapping(headers),
  };
}
```

- [ ] **Step 4: Run preview tests**

Run:

```bash
pnpm vitest run tests/vmMasterExcelImportPreview.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/vmMaster/excelImport.ts tests/vmMasterExcelImportPreview.test.ts
git commit -m "feat(vm-master): preview excel import mapping"
```

---

### Task 3: Excel Import Core Execution

**Files:**
- Modify: `server/vmMaster/excelImport.ts`
- Modify: `server/vmMaster/repository.ts`
- Test: `tests/vmMasterExcelImportExecute.test.ts`

- [ ] **Step 1: Write failing import execution tests**

Create `tests/vmMasterExcelImportExecute.test.ts`:

```ts
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import type { AdLookupClient } from "../server/ad/ldapClient";
import { applyVmMasterSchema, openVmMasterDatabase } from "../server/db/sqlite";
import { executeVmMasterExcelImport } from "../server/vmMaster/excelImport";

async function workbookBuffer(headers: string[], rows: unknown[][]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Import");
  sheet.addRow(headers);
  rows.forEach((row) => sheet.addRow(row));
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

function seedDb() {
  const db = openVmMasterDatabase(":memory:");
  applyVmMasterSchema(db);
  db.prepare(
    "INSERT INTO vm_users (ad_name, chn_name, email_address, bg, bu, report_to) VALUES (?, ?, ?, ?, ?, ?)",
  ).run("LEO.ZOU", "Leo Zou", "leo.zou@example.test", "DBG", "DDP", "");
  db.prepare("INSERT INTO vm_machines (vm_name) VALUES (?)").run("TWPJDDP01");
  db.prepare(
    "INSERT INTO vm_user_vm_assignments (ad_name, vm_name, group_name, zentera_role) VALUES (?, ?, ?, ?)",
  ).run("LEO.ZOU", "TWPJDDP01", "DDP_USERS", "DDP_USER");
  db.prepare("INSERT INTO vm_machines (vm_name) VALUES (?)").run("TWPJOPS01");
  db.prepare(
    "INSERT INTO vm_user_vm_assignments (ad_name, vm_name, group_name, zentera_role) VALUES (?, ?, ?, ?)",
  ).run("LEO.ZOU", "TWPJOPS01", "OPS_USERS", "OPS_USER");
  return db;
}

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
      },
    );

    expect(result.ok).toBe(true);
    expect(result.summary).toMatchObject({
      rowCount: 1,
      importedRowCount: 1,
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
        .prepare("SELECT vm_name, group_name, zentera_role FROM vm_user_vm_assignments WHERE ad_name = ? ORDER BY vm_name")
        .all("CHUNKAI.LIU"),
    ).toEqual([
      { vm_name: "TWPJDDP01", group_name: "DDP_USERS", zentera_role: "DDP_USER" },
      { vm_name: "TWPJOPS01", group_name: "OPS_USERS", zentera_role: "OPS_USER" },
    ]);
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
      },
    );

    expect(result.ok).toBe(true);
    expect(result.summary).toMatchObject({
      rowCount: 2,
      importedRowCount: 1,
      failedRowCount: 1,
      explicitAssignmentCount: 1,
    });
    expect(result.summary.warnings[0]).toMatchObject({
      ticketId: "excel-row-3",
      stage: "ldap",
      code: "user-not-found",
      adName: "MISSING.USER",
    });
    expect(
      db
        .prepare("SELECT vm_name, group_name, zentera_role FROM vm_user_vm_assignments WHERE ad_name = ?")
        .get("EXPLICIT.USER"),
    ).toEqual({ vm_name: "TWPJNEW01", group_name: "NEW_GROUP", zentera_role: "NEW_ROLE" });
  });
});
```

- [ ] **Step 2: Run the failing import tests**

Run:

```bash
pnpm vitest run tests/vmMasterExcelImportExecute.test.ts
```

Expected: FAIL because `executeVmMasterExcelImport` does not exist.

- [ ] **Step 3: Add repository helpers for DB fallback and explicit assignment fill**

Modify `server/vmMaster/repository.ts` by exporting these small helpers:

```ts
export function findVmUserForImport(
  database: VmMasterDatabase,
  adName: string,
): (VmUserSyncInput & { buCurr: string; bgCurr: string }) | null {
  const row = database
    .prepare(
      `SELECT ad_name, chn_name, email_address, bg, bu, user_role, user_dept, report_to, bu_curr, bg_curr
       FROM vm_users WHERE ad_name = ?`,
    )
    .get(adName) as
    | {
        ad_name: string;
        chn_name: string;
        email_address: string;
        bg: string;
        bu: string;
        user_role: string;
        user_dept: string;
        report_to: string;
        bu_curr: string;
        bg_curr: string;
      }
    | undefined;

  return row
    ? {
        adName: row.ad_name,
        chnName: row.chn_name,
        emailAddress: row.email_address,
        bg: row.bg,
        bu: row.bu,
        userRole: row.user_role,
        userDept: row.user_dept,
        reportTo: row.report_to,
        buCurr: row.bu_curr,
        bgCurr: row.bg_curr,
      }
    : null;
}

export function findAssignmentDefaultsForVm(
  database: VmMasterDatabase,
  vmName: string,
): VmAssignmentInput | null {
  const row = database
    .prepare(
      `SELECT vm_name, group_name, zentera_role
       FROM vm_user_vm_assignments
       WHERE vm_name = ?
       ORDER BY updated_at DESC
       LIMIT 1`,
    )
    .get(vmName) as
    | { vm_name: string; group_name: string; zentera_role: string }
    | undefined;

  return row
    ? { vmName: row.vm_name, groupName: row.group_name, zenteraRole: row.zentera_role }
    : null;
}
```

- [ ] **Step 4: Implement import execution**

Extend `server/vmMaster/excelImport.ts` with `executeVmMasterExcelImport()`. Keep the algorithm boring:

```ts
export type VmMasterExcelImportInput = {
  fileName: string;
  workbookBuffer: Buffer;
  mapping: Partial<Record<string, string>>;
  changedBy?: string;
};

export type VmMasterExcelImportDeps = {
  database: VmMasterDatabase;
  createLookupClient: () => AdLookupClient;
  startedAt?: string;
  logDir?: string;
};

export type VmMasterExcelImportResult =
  | {
      ok: true;
      summary: VmMasterExcelImportSummary;
      requestSummary: VmMasterExcelImportRequestSummary;
    }
  | { ok: false; error: string; logId?: string; logPath?: string };
```

Implement these private helpers in the same file:

```ts
function fieldValue(
  values: Record<string, string>,
  mapping: VmMasterExcelImportMapping,
  field: VmMasterExcelImportField,
): string {
  const source = Object.entries(mapping).find(([, target]) => target === field)?.[0];
  return source ? values[source]?.trim() ?? "" : "";
}

function createWarning(rowNumber: number, code: string, message: string, adName = "", detail?: string): HelpdeskVmSyncWarning {
  return {
    ticketId: `excel-row-${rowNumber}`,
    stage: code === "user-not-found" || code === "lookup-failed" ? "ldap" : "db",
    code,
    message,
    adName: adName || undefined,
    detail,
  };
}
```

In `executeVmMasterExcelImport()`:

- call `validateVmMasterExcelMapping()`
- call `parseVmMasterExcelPreview()` to get worksheet/header metadata
- parse the same worksheet rows into `{ rowNumber, values }[]`
- create one AD lookup client
- for each row:
  - get `AD_NAME`
  - lookup AD user
  - load DB fallback via `findVmUserForImport`
  - derive `reportTo` from `lookupManagerAccount()` or AD manager display name
  - upsert user via `upsertVmUserForSync`
  - build explicit assignment if `VM_NAME` exists, filling group/role from `findAssignmentDefaultsForVm()`
  - otherwise infer via `findManagerAdName()` and `findManagerAssignments()`
  - call `replaceUserVmAssignments()`
  - wrap each row in `BEGIN` / `COMMIT` / `ROLLBACK`
- return `ok: true` only if `importedRowCount > 0`
- call `writeHelpdeskVmSyncLog()` with `kind: "excel-import"` and the request summary

- [ ] **Step 5: Run import tests**

Run:

```bash
pnpm vitest run tests/vmMasterExcelImportExecute.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run preview tests again**

Run:

```bash
pnpm vitest run tests/vmMasterExcelImportPreview.test.ts tests/vmMasterExcelImportExecute.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add server/vmMaster/excelImport.ts server/vmMaster/repository.ts tests/vmMasterExcelImportExecute.test.ts
git commit -m "feat(vm-master): import excel rows into db"
```

---

### Task 4: Import Routes And Vite Wiring

**Files:**
- Create: `server/vmMaster/excelImportRoute.ts`
- Modify: `vite.config.ts`
- Test: `tests/vmMasterExcelImportRoute.test.ts`

- [ ] **Step 1: Write failing route tests**

Create `tests/vmMasterExcelImportRoute.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

import { createVmMasterExcelImportExecuteHandler, createVmMasterExcelImportPreviewHandler } from "../server/vmMaster/excelImportRoute";

function createMockResponse() {
  return {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: "",
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
    end(payload: string) {
      this.body = payload;
    },
  };
}

describe("VM Master Excel import routes", () => {
  it("previews base64 workbook payloads", async () => {
    const handler = createVmMasterExcelImportPreviewHandler({
      readBody: vi.fn().mockResolvedValue(
        JSON.stringify({ fileName: "vm-master.xlsx", workbookBase64: Buffer.from("x").toString("base64") }),
      ),
      previewWorkbook: vi.fn().mockResolvedValue({
        fileName: "vm-master.xlsx",
        worksheetName: "Import",
        headers: ["AD_NAME"],
        rowCount: 1,
        sampleRows: [],
        importableFields: ["AD_NAME"],
        defaultMapping: { AD_NAME: "AD_NAME" },
      }),
    });
    const response = createMockResponse();

    await handler({ method: "POST" } as never, response as never);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({ ok: true, fileName: "vm-master.xlsx" });
  });

  it("rejects malformed execute payloads", async () => {
    const handler = createVmMasterExcelImportExecuteHandler({
      readBody: vi.fn().mockResolvedValue("{"),
      executeImport: vi.fn(),
    });
    const response = createMockResponse();

    await handler({ method: "POST" } as never, response as never);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error).toBe("Malformed VM Master Excel import payload");
  });
});
```

- [ ] **Step 2: Run failing route tests**

Run:

```bash
pnpm vitest run tests/vmMasterExcelImportRoute.test.ts
```

Expected: FAIL because `excelImportRoute.ts` does not exist.

- [ ] **Step 3: Implement route handlers**

Create `server/vmMaster/excelImportRoute.ts`:

```ts
import type { IncomingMessage, ServerResponse } from "node:http";
import { createAdLookupClient } from "../ad/ldapClient";
import { applyVmMasterSchema, openVmMasterDatabase } from "../db/sqlite";
import { readBody as readBodyImpl, sendJson } from "../http";
import {
  executeVmMasterExcelImport,
  parseVmMasterExcelPreview,
  type VmMasterExcelImportInput,
} from "./excelImport";

type PreviewDeps = {
  readBody?: typeof readBodyImpl;
  previewWorkbook?: typeof parseVmMasterExcelPreview;
};

type ExecuteDeps = {
  readBody?: typeof readBodyImpl;
  executeImport?: typeof executeVmMasterExcelImport;
};

function parseWorkbookPayload(body: string): Omit<VmMasterExcelImportInput, "mapping"> {
  const payload = JSON.parse(body) as Record<string, unknown>;
  if (typeof payload.fileName !== "string" || typeof payload.workbookBase64 !== "string") {
    throw new Error("VM Master Excel import requires fileName and workbookBase64");
  }
  return {
    fileName: payload.fileName,
    workbookBuffer: Buffer.from(payload.workbookBase64, "base64"),
    changedBy: typeof payload.changedBy === "string" ? payload.changedBy : undefined,
  };
}

export function createVmMasterExcelImportPreviewHandler(deps: PreviewDeps = {}) {
  const readBody = deps.readBody ?? readBodyImpl;
  const previewWorkbook = deps.previewWorkbook ?? parseVmMasterExcelPreview;

  return async (request: IncomingMessage, response: ServerResponse) => {
    if (request.method !== "POST") {
      sendJson(response, { ok: false, error: "Method not allowed" }, 405);
      return;
    }
    try {
      const payload = parseWorkbookPayload(await readBody(request));
      const preview = await previewWorkbook(payload);
      sendJson(response, { ok: true, ...preview });
    } catch (error) {
      sendJson(response, { ok: false, error: error instanceof SyntaxError ? "Malformed VM Master Excel import payload" : error instanceof Error ? error.message : "Excel import preview failed" }, 400);
    }
  };
}

export function createVmMasterExcelImportExecuteHandler(deps: ExecuteDeps = {}) {
  const readBody = deps.readBody ?? readBodyImpl;
  const executeImport = deps.executeImport ?? executeVmMasterExcelImport;

  return async (request: IncomingMessage, response: ServerResponse) => {
    if (request.method !== "POST") {
      sendJson(response, { ok: false, error: "Method not allowed" }, 405);
      return;
    }
    let database;
    try {
      const body = await readBody(request);
      const parsed = JSON.parse(body) as Record<string, unknown>;
      const payload = parseWorkbookPayload(body);
      database = openVmMasterDatabase();
      applyVmMasterSchema(database);
      const result = await executeImport(
        { ...payload, mapping: (parsed.mapping ?? {}) as Record<string, string> },
        { database, createLookupClient: createAdLookupClient },
      );
      sendJson(response, result, result.ok ? 200 : 500);
    } catch (error) {
      sendJson(response, { ok: false, error: error instanceof SyntaxError ? "Malformed VM Master Excel import payload" : error instanceof Error ? error.message : "Excel import execute failed" }, 400);
    } finally {
      database?.close();
    }
  };
}
```

- [ ] **Step 4: Wire routes into Vite middleware**

Modify `vite.config.ts` imports:

```ts
import {
  createVmMasterExcelImportExecuteHandler,
  createVmMasterExcelImportPreviewHandler,
} from "./server/vmMaster/excelImportRoute";
```

Add before sync log route:

```ts
server.middlewares.use(
  "/api/vm-master/import-excel/preview",
  createVmMasterExcelImportPreviewHandler(),
);
server.middlewares.use(
  "/api/vm-master/import-excel/execute",
  createVmMasterExcelImportExecuteHandler(),
);
```

- [ ] **Step 5: Run route tests**

Run:

```bash
pnpm vitest run tests/vmMasterExcelImportRoute.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run backend import suite**

Run:

```bash
pnpm vitest run tests/vmMasterExcelImportPreview.test.ts tests/vmMasterExcelImportExecute.test.ts tests/vmMasterExcelImportRoute.test.ts tests/vmMasterExecutionLog.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add server/vmMaster/excelImportRoute.ts vite.config.ts tests/vmMasterExcelImportRoute.test.ts
git commit -m "feat(vm-master): expose excel import api"
```

---

### Task 5: Client API And Import State

**Files:**
- Modify: `src/features/vm-master/types.ts`
- Modify: `src/features/vm-master/api.ts`
- Create: `src/features/vm-master/excelImportMapping.ts`
- Create: `src/features/vm-master/useVmMasterExcelImport.ts`
- Test: `tests/vmMasterExcelImportMapping.test.ts`

- [ ] **Step 1: Write failing mapping-helper tests**

Create `tests/vmMasterExcelImportMapping.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { getDisabledImportFields, updateImportMapping } from "../src/features/vm-master/excelImportMapping";

describe("VM Master Excel import mapping helpers", () => {
  it("disables fields selected by other headers", () => {
    const mapping = {
      "AD Name": "AD_NAME",
      VM: "VM_NAME",
    };

    expect(getDisabledImportFields(mapping, "AD Name")).toEqual(new Set(["VM_NAME"]));
    expect(getDisabledImportFields(mapping, "VM")).toEqual(new Set(["AD_NAME"]));
  });

  it("updates mapping without keeping blank selections", () => {
    expect(updateImportMapping({ A: "AD_NAME" }, "A", "")).toEqual({});
    expect(updateImportMapping({ A: "AD_NAME" }, "B", "VM_NAME")).toEqual({
      A: "AD_NAME",
      B: "VM_NAME",
    });
  });
});
```

- [ ] **Step 2: Run failing mapping-helper tests**

Run:

```bash
pnpm vitest run tests/vmMasterExcelImportMapping.test.ts
```

Expected: FAIL because `excelImportMapping.ts` does not exist.

- [ ] **Step 3: Add client import types**

Modify `src/features/vm-master/types.ts`:

```ts
export type VmMasterExcelImportField =
  | "AD_NAME"
  | "CHN_NAME"
  | "EMAIL_ADDRESS"
  | "BG"
  | "BU"
  | "USER_ROLE"
  | "GROUP_NAME"
  | "VM_NAME"
  | "MAX_ONLINE_USERS"
  | "ZENTERA_ROLE"
  | "USER_DEPT"
  | "REPORT_TO"
  | "BU_CURR"
  | "BG_CURR";

export type VmMasterExcelImportMapping = Partial<Record<string, VmMasterExcelImportField>>;

export type VmMasterExcelPreviewSampleRow = {
  rowNumber: number;
  values: Record<string, string>;
};

export type VmMasterExcelPreviewResult =
  | {
      ok: true;
      fileName: string;
      worksheetName: string;
      headers: string[];
      rowCount: number;
      sampleRows: VmMasterExcelPreviewSampleRow[];
      importableFields: VmMasterExcelImportField[];
      defaultMapping: VmMasterExcelImportMapping;
    }
  | { ok: false; error: string };

export type VmMasterExcelImportSummary = {
  rowCount: number;
  importedRowCount: number;
  failedRowCount: number;
  adEnrichedCount: number;
  dbFilledCount: number;
  managerInferredAssignmentCount: number;
  explicitAssignmentCount: number;
  warnings: HelpdeskVmSyncWarning[];
  logId?: string;
  logPath?: string;
};

export type VmMasterExcelImportExecuteResult =
  | { ok: true; summary: VmMasterExcelImportSummary }
  | { ok: false; error: string; logId?: string; logPath?: string };
```

Also add optional execution log fields:

```ts
export type VmMasterExecutionKind = "helpdesk-sync" | "excel-import";
```

Add `kind: VmMasterExecutionKind` to `HelpdeskVmSyncLogEntry` and `HelpdeskVmSyncLogListItem`. Make it optional only if TypeScript forces existing callsites, then default in UI with `selectedLog.kind ?? "helpdesk-sync"`.

- [ ] **Step 4: Add client API functions**

Modify `src/features/vm-master/api.ts`:

```ts
import type {
  VmMasterExcelImportExecuteResult,
  VmMasterExcelImportMapping,
  VmMasterExcelPreviewResult,
} from "./types";

export async function previewVmMasterExcelImport(payload: {
  fileName: string;
  workbookBase64: string;
}): Promise<VmMasterExcelPreviewResult> {
  return requestJson<VmMasterExcelPreviewResult>(
    "/api/vm-master/import-excel/preview",
    { method: "POST", body: payload },
    "VM Master Excel import preview",
  );
}

export async function executeVmMasterExcelImport(payload: {
  fileName: string;
  workbookBase64: string;
  mapping: VmMasterExcelImportMapping;
}): Promise<VmMasterExcelImportExecuteResult> {
  return requestJson<VmMasterExcelImportExecuteResult>(
    "/api/vm-master/import-excel/execute",
    { method: "POST", body: payload },
    "VM Master Excel import",
  );
}
```

- [ ] **Step 5: Add mapping helpers**

Create `src/features/vm-master/excelImportMapping.ts`:

```ts
import type { VmMasterExcelImportField, VmMasterExcelImportMapping } from "./types";

export function getDisabledImportFields(
  mapping: VmMasterExcelImportMapping,
  currentHeader: string,
): Set<VmMasterExcelImportField> {
  return new Set(
    Object.entries(mapping)
      .filter(([header]) => header !== currentHeader)
      .map(([, field]) => field)
      .filter((field): field is VmMasterExcelImportField => Boolean(field)),
  );
}

export function updateImportMapping(
  mapping: VmMasterExcelImportMapping,
  header: string,
  field: VmMasterExcelImportField | "",
): VmMasterExcelImportMapping {
  const next = { ...mapping };
  if (!field) {
    delete next[header];
    return next;
  }
  next[header] = field;
  return next;
}
```

- [ ] **Step 6: Add import composable**

Create `src/features/vm-master/useVmMasterExcelImport.ts`:

```ts
import { computed, readonly, shallowRef } from "vue";
import {
  executeVmMasterExcelImport as executeImportApi,
  previewVmMasterExcelImport as previewImportApi,
} from "./api";
import type {
  VmMasterExcelImportMapping,
  VmMasterExcelImportSummary,
  VmMasterExcelPreviewResult,
} from "./types";
import { useAsyncTask } from "./useAsyncTask";

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function useVmMasterExcelImport(options: { refreshPreview: () => Promise<void> }) {
  const task = useAsyncTask();
  const fileName = shallowRef("");
  const workbookBase64 = shallowRef("");
  const preview = shallowRef<Extract<VmMasterExcelPreviewResult, { ok: true }> | null>(null);
  const mapping = shallowRef<VmMasterExcelImportMapping>({});
  const summary = shallowRef<VmMasterExcelImportSummary | null>(null);
  const showOverlay = computed(() => Boolean(preview.value));

  async function previewFile(file: File): Promise<void> {
    fileName.value = file.name;
    workbookBase64.value = await fileToBase64(file);
    summary.value = null;
    const result = await task.run(
      () => previewImportApi({ fileName: file.name, workbookBase64: workbookBase64.value }),
      "Failed to preview VM Master Excel import",
    );
    if (!result) return;
    if (!result.ok) {
      task.setError(result.error);
      return;
    }
    preview.value = result;
    mapping.value = { ...result.defaultMapping };
  }

  function closeOverlay(): void {
    preview.value = null;
    mapping.value = {};
  }

  async function executeImport(): Promise<void> {
    const result = await task.run(
      () => executeImportApi({ fileName: fileName.value, workbookBase64: workbookBase64.value, mapping: mapping.value }),
      "Failed to import VM Master Excel",
    );
    if (!result) return;
    if (!result.ok) {
      task.setError(result.error);
      return;
    }
    summary.value = result.summary;
    closeOverlay();
    await options.refreshPreview();
  }

  return {
    loading: task.loading,
    error: task.error,
    preview: readonly(preview),
    mapping,
    summary: readonly(summary),
    showOverlay,
    previewFile,
    closeOverlay,
    executeImport,
  };
}
```

- [ ] **Step 7: Run mapping tests**

Run:

```bash
pnpm vitest run tests/vmMasterExcelImportMapping.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/features/vm-master/types.ts src/features/vm-master/api.ts src/features/vm-master/excelImportMapping.ts src/features/vm-master/useVmMasterExcelImport.ts tests/vmMasterExcelImportMapping.test.ts
git commit -m "feat(vm-master): add excel import client state"
```

---

### Task 6: VM Master Mapping Overlay UI

**Files:**
- Modify: `src/features/vm-master/VmMasterPreviewPage.vue`
- Modify: `src/styles.css`

- [ ] **Step 1: Wire import composable into page script**

Modify `src/features/vm-master/VmMasterPreviewPage.vue` imports:

```ts
import { getDisabledImportFields, updateImportMapping } from "./excelImportMapping";
import { useVmMasterExcelImport } from "./useVmMasterExcelImport";
import type { VmMasterExcelImportField } from "./types";
```

Add state below sync log setup:

```ts
const fileInput = ref<HTMLInputElement | null>(null);
const {
  loading: importingExcel,
  error: importError,
  preview: excelPreview,
  mapping: excelMapping,
  summary: excelImportSummary,
  showOverlay: showExcelImportOverlay,
  previewFile,
  closeOverlay: closeExcelImportOverlay,
  executeImport: executeExcelImport,
} = useVmMasterExcelImport({ refreshPreview: loadPreview });
```

Add handlers:

```ts
function openExcelImportPicker(): void {
  fileInput.value?.click();
}

async function handleExcelFileChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  await previewFile(file);
}

function changeExcelMapping(header: string, event: Event): void {
  const select = event.target as HTMLSelectElement;
  excelMapping.value = updateImportMapping(
    excelMapping.value,
    header,
    select.value as VmMasterExcelImportField | "",
  );
}

function isImportFieldDisabled(header: string, field: VmMasterExcelImportField): boolean {
  return getDisabledImportFields(excelMapping.value, header).has(field);
}

async function runExcelImport(): Promise<void> {
  await executeExcelImport();
  if (showSyncHistory.value) await loadHistory();
}
```

- [ ] **Step 2: Add Import Excel button and hidden file input**

In the page header actions, add before `Sync Helpdesk`:

```vue
<input
  ref="fileInput"
  class="visually-hidden"
  type="file"
  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  @change="handleExcelFileChange"
/>
<button
  type="button"
  class="secondary-action"
  :disabled="loading || syncing || importingExcel"
  @click="openExcelImportPicker"
>
  {{ importingExcel ? "Importing" : "Import Excel" }}
</button>
```

- [ ] **Step 3: Add import status messages**

Below existing error sections:

```vue
<section v-if="importError" class="status-message error">
  {{ importError }}
</section>

<section v-if="excelImportSummary" class="status-message success">
  <span>
    Imported {{ excelImportSummary.importedRowCount }} of {{ excelImportSummary.rowCount }} Excel row(s) /
    {{ excelImportSummary.failedRowCount }} failed /
    {{ excelImportSummary.warnings.length }} warnings
  </span>
  <button type="button" class="inline-link-button" @click="openSyncHistory">
    View execution history
  </button>
</section>
```

- [ ] **Step 4: Add mapping overlay card**

Place before `<VmMasterTable ... />`:

```vue
<div v-if="showExcelImportOverlay && excelPreview" class="overlay-backdrop" role="presentation">
  <section class="mapping-card" role="dialog" aria-modal="true" aria-label="Map Excel columns">
    <header class="mapping-card-header">
      <div>
        <h2>Map Excel columns</h2>
        <p class="subtle">
          {{ excelPreview.fileName }} / {{ excelPreview.worksheetName }} /
          {{ excelPreview.rowCount }} rows
        </p>
      </div>
      <button type="button" class="secondary-action" :disabled="importingExcel" @click="closeExcelImportOverlay">
        Cancel
      </button>
    </header>

    <div class="mapping-table-frame">
      <table class="mapping-table">
        <thead>
          <tr>
            <th>Excel column</th>
            <th>DB field</th>
            <th>Sample</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="header in excelPreview.headers" :key="header">
            <td>{{ header }}</td>
            <td>
              <select
                class="mapping-select"
                :value="excelMapping[header] ?? ''"
                @change="changeExcelMapping(header, $event)"
              >
                <option value="">Skip</option>
                <option
                  v-for="field in excelPreview.importableFields"
                  :key="field"
                  :value="field"
                  :disabled="isImportFieldDisabled(header, field)"
                >
                  {{ field }}
                </option>
              </select>
            </td>
            <td>
              <span class="subtle">
                {{ excelPreview.sampleRows[0]?.values[header] ?? "" }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <footer class="mapping-card-actions">
      <button type="button" class="secondary-action" :disabled="importingExcel" @click="closeExcelImportOverlay">
        Cancel
      </button>
      <button type="button" class="primary-action" :disabled="importingExcel" @click="runExcelImport">
        {{ importingExcel ? "Importing" : "Import" }}
      </button>
    </footer>
  </section>
</div>
```

- [ ] **Step 5: Add overlay CSS**

Modify `src/styles.css`:

```css
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.overlay-backdrop {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 48px 24px;
  background: rgba(15, 23, 42, 0.38);
  overflow: auto;
}

.mapping-card {
  width: min(960px, 100%);
  max-height: calc(100vh - 96px);
  display: flex;
  flex-direction: column;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 24px 80px rgba(15, 23, 42, 0.22);
}

.mapping-card-header,
.mapping-card-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 20px;
  border-bottom: 1px solid #e5e7eb;
}

.mapping-card-actions {
  border-top: 1px solid #e5e7eb;
  border-bottom: 0;
  justify-content: flex-end;
}

.mapping-table-frame {
  overflow: auto;
  padding: 0 20px;
}

.mapping-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.mapping-table th,
.mapping-table td {
  padding: 10px 8px;
  border-bottom: 1px solid #eef2f7;
  text-align: left;
  vertical-align: top;
}

.mapping-select {
  width: 100%;
  min-height: 36px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: #fff;
  color: #0f172a;
}
```

- [ ] **Step 6: Build-check the UI**

Run:

```bash
pnpm build
```

Expected: PASS. If sandbox returns `spawn EPERM`, rerun the same command with escalation.

- [ ] **Step 7: Commit**

```bash
git add src/features/vm-master/VmMasterPreviewPage.vue src/styles.css
git commit -m "feat(vm-master): add excel import mapping overlay"
```

---

### Task 7: Execution History UI For Both Operation Kinds

**Files:**
- Modify: `src/features/vm-master/VmMasterPreviewPage.vue`
- Modify: `src/features/vm-master/types.ts`

- [ ] **Step 1: Add summary label helpers**

In `VmMasterPreviewPage.vue`, add:

```ts
function executionKindLabel(kind: string | undefined): string {
  return kind === "excel-import" ? "Excel import" : "Sync Helpdesk";
}

function selectedExecutionSummaryRows() {
  if (!selectedLog.value) return [];
  if (selectedLog.value.kind === "excel-import") {
    const summary = selectedLog.value.summary as import("./types").VmMasterExcelImportSummary;
    return [
      ["Rows imported", summary.importedRowCount],
      ["Rows failed", summary.failedRowCount],
      ["AD enriched", summary.adEnrichedCount],
      ["Warnings", selectedLog.value.warnings.length],
      ["Status", selectedLog.value.ok ? "Success" : "Failed"],
    ];
  }
  const summary = selectedLog.value.summary as import("./types").HelpdeskVmSyncSummary;
  return [
    ["Users synced", summary.userUpsertedCount],
    ["Assignments inserted", summary.assignmentInsertedCount],
    ["Warnings", selectedLog.value.warnings.length],
    ["Status", selectedLog.value.ok ? "Success" : "Failed"],
  ];
}
```

- [ ] **Step 2: Update history labels**

Change:

```vue
<h2>'Sync Helpdesk' execution history</h2>
```

to:

```vue
<h2>VM Master execution history</h2>
```

Change the execution dot title to include kind:

```vue
:title="`${executionKindLabel(entry.kind)} / ${formatExecutionTime(entry.finishedAt)} / ${entry.warningCount} warning(s)`"
```

- [ ] **Step 3: Replace hard-coded summary grid**

Replace the current selected summary grid body:

```vue
<template v-for="[label, value] in selectedExecutionSummaryRows()" :key="label">
  <span>{{ label }}</span>
  <strong>{{ value }}</strong>
</template>
```

- [ ] **Step 4: Add request summary display**

Add after the Time section:

```vue
<section v-if="selectedLog.requestSummary" class="execution-detail-section">
  <h3>Request</h3>
  <pre class="log-output">{{ JSON.stringify(selectedLog.requestSummary, null, 2) }}</pre>
</section>
```

- [ ] **Step 5: Build-check**

Run:

```bash
pnpm build
```

Expected: PASS. If sandbox returns `spawn EPERM`, rerun with escalation.

- [ ] **Step 6: Commit**

```bash
git add src/features/vm-master/VmMasterPreviewPage.vue src/features/vm-master/types.ts
git commit -m "feat(vm-master): show execution request summaries"
```

---

### Task 8: Docs, Progress, And Full Verification

**Files:**
- Modify: `docs/PROGRESS.md`
- Modify: `docs/helpdesk-workflow.md`

- [ ] **Step 1: Update operator docs**

Add to `docs/helpdesk-workflow.md` under VM Master sync:

```md
### VM Master Excel import

- Use **Import Excel** on the VM Master Preview page.
- Upload a `.xlsx` workbook. The first non-empty worksheet is parsed.
- Confirm column mapping in the overlay card. Matching Excel/DB field names are mapped by default.
- Mapping is one-to-one; a DB field already selected in one row is disabled for other Excel columns.
- Import uses each Excel row as input, enriches with AD and existing VM Master DB data, then infers missing VM assignments from the imported user's manager assignments.
- Successful rows are written to SQLite. Failed rows are skipped and recorded in VM Master execution history.
```

- [ ] **Step 2: Update progress tracker**

Modify `docs/PROGRESS.md`:

- Refresh `最後更新` to `2026-07-01`.
- Add an iteration row named `VM Master Excel import`.
- Mark `VM Master Excel import UI`, `Excel mapping validation`, `AD/DB enrichment import`, and `VM Master execution request summaries` as done in the active progress table if those rows exist; otherwise add one concise completed row under the iteration record only.
- Keep `建議下一步` focused on operator validation and any remaining hardening.

- [ ] **Step 3: Run focused tests**

Run:

```bash
pnpm vitest run tests/vmMasterExecutionLog.test.ts tests/vmMasterExcelImportPreview.test.ts tests/vmMasterExcelImportExecute.test.ts tests/vmMasterExcelImportRoute.test.ts tests/vmMasterExcelImportMapping.test.ts
```

Expected: PASS.

- [ ] **Step 4: Run full test suite**

Run:

```bash
pnpm test
```

Expected: PASS. If sandbox returns `spawn EPERM`, rerun with escalation.

- [ ] **Step 5: Run production build**

Run:

```bash
pnpm build
```

Expected: PASS. If sandbox returns `spawn EPERM`, rerun with escalation.

- [ ] **Step 6: Commit docs and verification fixes**

```bash
git add docs/PROGRESS.md docs/helpdesk-workflow.md
git commit -m "docs(vm-master): document excel import workflow"
```

---

## Self-Review Notes

- Spec coverage: Tasks cover upload/preview, one-to-one mapping, AD/DB enrichment, manager assignment inference, execution record request summaries, UI overlay, docs, tests, and build verification.
- No new dependencies: JSON base64 upload and existing `exceljs` are used.
- Scope held: no standalone script, no multipart parser, no temp file storage, no sheet picker.
- Main risk: `btoa` on large files is acceptable for the local-operator workflow; replace with chunked encoding only if operators hit browser memory limits.


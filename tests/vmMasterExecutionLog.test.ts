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
        rows: [{ rowNumber: 2, adName: "CHUNKAI.LIU", vmName: "TWPJDDP01" }],
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

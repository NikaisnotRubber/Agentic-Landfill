import { describe, expect, it, vi } from "vitest";

import {
  createVmMasterExcelImportExecuteHandler,
  createVmMasterExcelImportPreviewHandler,
} from "../server/vmMaster/excelImportRoute";

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
        JSON.stringify({
          fileName: "vm-master.xlsx",
          workbookBase64: Buffer.from("x").toString("base64"),
        }),
      ),
      previewWorkbook: vi.fn().mockResolvedValue({
        fileName: "vm-master.xlsx",
        worksheetName: "Import",
        worksheets: [{ worksheetName: "Import", rowCount: 1, headers: ["AD_NAME", "WORK_SHEET"] }],
        headers: ["AD_NAME", "WORK_SHEET"],
        rowCount: 1,
        sampleRows: [],
        importableFields: ["AD_NAME", "WORK_SHEET"],
        defaultMapping: { AD_NAME: "AD_NAME", WORK_SHEET: "WORK_SHEET" },
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
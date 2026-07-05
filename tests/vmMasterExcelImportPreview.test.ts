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
      headers: ["AD Name", "VM_NAME", "Report To", "Ignored", "WORK_SHEET"],
      rowCount: 2,
      defaultMapping: {
        "AD Name": "AD_NAME",
        VM_NAME: "VM_NAME",
        "Report To": "REPORT_TO",
        WORK_SHEET: "WORK_SHEET",
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
          WORK_SHEET: "Import",
        },
      },
      {
        rowNumber: 3,
        values: {
          "AD Name": "SUNGCHAO.SC.YU",
          VM_NAME: "",
          "Report To": "MANAGER.AD",
          Ignored: "y",
          WORK_SHEET: "Import",
        },
      },
    ]);
    expect(preview.importableFields).toContain("AD_NAME");
  });

  it("extracts rows from every worksheet and exposes worksheet names as a virtual column", async () => {
    const buffer = await multiSheetWorkbookBuffer([
      {
        name: "DDP",
        headers: ["AD_NAME", "VM_NAME"],
        rows: [["CHUNKAI.LIU", "TWPJDDP01"]],
      },
      {
        name: "OPS",
        headers: ["AD_NAME", "GROUP_NAME"],
        rows: [["SUNGCHAO.SC.YU", "OPS_USERS"]],
      },
    ]);

    const preview = await parseVmMasterExcelPreview({
      fileName: "vm-master.xlsx",
      workbookBuffer: buffer,
    });

    expect(preview).toMatchObject({
      worksheetName: "DDP, OPS",
      worksheets: [
        { worksheetName: "DDP", rowCount: 1 },
        { worksheetName: "OPS", rowCount: 1 },
      ],
      headers: ["AD_NAME", "VM_NAME", "WORK_SHEET", "GROUP_NAME"],
      rowCount: 2,
      defaultMapping: {
        AD_NAME: "AD_NAME",
        VM_NAME: "VM_NAME",
        GROUP_NAME: "GROUP_NAME",
        WORK_SHEET: "WORK_SHEET",
      },
    });
    expect(preview.sampleRows).toEqual([
      {
        worksheetName: "DDP",
        rowNumber: 2,
        values: {
          AD_NAME: "CHUNKAI.LIU",
          VM_NAME: "TWPJDDP01",
          WORK_SHEET: "DDP",
        },
      },
      {
        worksheetName: "OPS",
        rowNumber: 2,
        values: {
          AD_NAME: "SUNGCHAO.SC.YU",
          GROUP_NAME: "OPS_USERS",
          WORK_SHEET: "OPS",
        },
      },
    ]);
    expect(preview.importableFields).toContain("WORK_SHEET");
  });

  it("keeps sample values aligned when header columns are blank", async () => {
    const buffer = await workbookBuffer(
      ["AD Name", "", "VM_NAME"],
      [["CHUNKAI.LIU", "ignored gap", "TWPJDDP01"]],
    );

    const preview = await parseVmMasterExcelPreview({
      fileName: "vm-master.xlsx",
      workbookBuffer: buffer,
    });

    expect(preview.headers).toEqual(["AD Name", "VM_NAME", "WORK_SHEET"]);
    expect(preview.sampleRows[0]?.values).toEqual({
      "AD Name": "CHUNKAI.LIU",
      VM_NAME: "TWPJDDP01",
      WORK_SHEET: "Import",
    });
  });

  it("stringifies formula-only cells and still prefers formula results", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Import");
    sheet.addRow(["AD Name", "Formula Only", "Formula Result"]);
    sheet.addRow(["CHUNKAI.LIU"]);
    sheet.getCell("B2").value = { formula: 'A2&"-VM"' };
    sheet.getCell("C2").value = { formula: 'A2&"-IGNORED"', result: "TWPJDDP01" };

    const preview = await parseVmMasterExcelPreview({
      fileName: "vm-master.xlsx",
      workbookBuffer: Buffer.from(await workbook.xlsx.writeBuffer()),
    });

    expect(preview.sampleRows[0]?.values).toMatchObject({
      "Formula Only": 'A2&"-VM"',
      "Formula Result": "TWPJDDP01",
    });
  });

  it("rejects duplicate nonblank headers", async () => {
    const buffer = await workbookBuffer(
      ["AD Name", "", "AD Name"],
      [["CHUNKAI.LIU", "ignored gap", "SUNGCHAO.SC.YU"]],
    );

    await expect(
      parseVmMasterExcelPreview({
        fileName: "vm-master.xlsx",
        workbookBuffer: buffer,
      }),
    ).rejects.toThrow("Duplicate VM Master Excel header: AD Name");
  });

  it("counts data rows using only nonblank header columns", async () => {
    const buffer = await workbookBuffer(
      ["AD Name", "", "VM_NAME"],
      [
        ["", "ignored gap", ""],
        ["CHUNKAI.LIU", "", ""],
      ],
    );

    const preview = await parseVmMasterExcelPreview({
      fileName: "vm-master.xlsx",
      workbookBuffer: buffer,
    });

    expect(preview.rowCount).toBe(1);
    expect(preview.sampleRows).toEqual([
      {
        rowNumber: 3,
        values: {
          "AD Name": "CHUNKAI.LIU",
          VM_NAME: "",
          WORK_SHEET: "Import",
        },
      },
    ]);
  });

  it("rejects non-string mapping target values with a clear error", () => {
    expect(() =>
      validateVmMasterExcelMapping({
        Account: "AD_NAME",
        Bad: 123,
      }),
    ).toThrow("Invalid VM Master import target field: 123");

    expect(() =>
      validateVmMasterExcelMapping({
        Account: "AD_NAME",
        Bad: { field: "VM_NAME" },
      }),
    ).toThrow("Invalid VM Master import target field: [object Object]");
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

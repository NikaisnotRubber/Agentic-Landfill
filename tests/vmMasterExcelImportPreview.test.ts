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
    expect(preview.importableFields).toContain("AD_NAME");
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

    expect(preview.headers).toEqual(["AD Name", "VM_NAME"]);
    expect(preview.sampleRows[0]?.values).toEqual({
      "AD Name": "CHUNKAI.LIU",
      VM_NAME: "TWPJDDP01",
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

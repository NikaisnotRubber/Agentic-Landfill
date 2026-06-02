import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import {
  buildDdpExcelAbnormalIssues,
  buildDdpExcelRowRecord,
  buildDdpExcelRowRecords,
  resolveExportMail,
} from "../server/excel/buildDdpExcelRows";
import {
  DDP_EXCEL_COLUMNS,
  DDP_EXCEL_GROUP_OWNER,
  DDP_EXCEL_SHEET_ALL,
  DDP_EXCEL_SHEET_CLOSED,
  DDP_EXCEL_SHEET_PENDING,
} from "../server/excel/ddpExcelColumns";
import { exportDdpWorkbookBuffer } from "../server/excel/exportDdpWorkbook";
import type { ProcessedDdpRow } from "../server/ddp/types";
import type { TicketRecord } from "../server/types";

function makeTicket(overrides: Partial<TicketRecord> = {}): TicketRecord {
  return {
    id: "822184",
    subject: "[DDP] Test ticket",
    requester: "LEO.ZOU 鄒皓年",
    technician: "",
    created_time: "",
    site: "",
    category: "",
    status: "Open",
    group: "",
    short_description: "",
    ...overrides,
  };
}

function makeProcessed(overrides: Partial<ProcessedDdpRow> = {}): ProcessedDdpRow {
  return {
    ticketId: "822184",
    status: "Open",
    subject: "[DDP] Test ticket",
    requester: "LEO.ZOU 鄒皓年",
    isNewTicket: false,
    adAccount: "LEO.ZOU",
    adName: "鄒皓年",
    firstName: "LEO",
    lastName: "ZOU",
    mail: "",
    bu: "BU1",
    nbHostname: "TWCL1NB5308",
    vmHostname: "TWPJRDPSCNLT05",
    role: "LT",
    application: "",
    userRoles: "",
    abnormalFlags: [],
    ...overrides,
  };
}

describe("buildDdpExcelRows", () => {
  it("matches the Python COLUMNS order and fixed Group Owner", () => {
    const record = buildDdpExcelRowRecord(makeTicket(), makeProcessed());
    expect(record.values).toHaveLength(DDP_EXCEL_COLUMNS.length);
    expect(record.values[0]).toBe("822184");
    expect(record.values[11]).toBe(DDP_EXCEL_GROUP_OWNER);
    expect(record.values[12]).toBe("");
  });

  it("fills mail from AD account when missing", () => {
    expect(resolveExportMail("LEO.ZOU", "")).toBe("LEO.ZOU@deltaww.com");
    expect(resolveExportMail("LEO.ZOU", "a@b.com")).toBe("a@b.com");
  });

  it("flags abnormal for missing AD, missing NB, and invalid VM placeholder", () => {
    expect(
      buildDdpExcelAbnormalIssues({
        adAccount: "",
        nbHostname: "",
        invalidVmValue: "localhost",
      }),
    ).toEqual(["AD Account", "NB Hostname", "VM HostName(無效值:localhost)"]);
  });

  it("aligns Excel abnormal with processed missing-vm flag", () => {
    const record = buildDdpExcelRowRecord(
      makeTicket(),
      makeProcessed({
        abnormalFlags: ["missing-nb-hostname", "missing-vm-hostname"],
      }),
    );

    expect(record.abnormalFlag).toBe("檢查");
    expect(record.abnormalHyperlink).toContain("woID=");
  });

  it("sets abnormal hyperlink metadata when required fields are missing", () => {
    const record = buildDdpExcelRowRecord(
      makeTicket({ short_description: "VM HostName: localhost" }),
      makeProcessed({
        adAccount: "",
        nbHostname: "",
        vmHostname: "",
        abnormalFlags: ["missing-ad-account", "missing-nb-hostname", "invalid-vm-hostname"],
      }),
    );

    expect(record.abnormalFlag).toBe("檢查");
    expect(record.abnormalHyperlink).toContain("woID=822184");
    expect(record.abnormalSubject).toBe("[DDP] Test ticket");
  });
});

describe("exportDdpWorkbookBuffer", () => {
  it("creates 待處理, Closed, and All sheets with styled headers", async () => {
    const tickets: TicketRecord[] = [
      makeTicket({ id: "1", status: "Open" }),
      makeTicket({ id: "2", status: "Onhold" }),
      makeTicket({ id: "3", status: "Closed" }),
    ];
    const processedRows = tickets.map((ticket) =>
      makeProcessed({
        ticketId: ticket.id,
        status: ticket.status,
        adAccount: "USER.A",
        nbHostname: "TWCL1NB1234",
      }),
    );

    const { buffer, pendingCount, closedCount, totalCount } = await exportDdpWorkbookBuffer({
      tickets,
      processedRows,
    });

    expect(totalCount).toBe(3);
    expect(pendingCount).toBe(2);
    expect(closedCount).toBe(1);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    expect(workbook.getWorksheet(DDP_EXCEL_SHEET_PENDING)?.rowCount).toBe(3);
    expect(workbook.getWorksheet(DDP_EXCEL_SHEET_CLOSED)?.rowCount).toBe(2);
    expect(workbook.getWorksheet(DDP_EXCEL_SHEET_ALL)?.rowCount).toBe(4);

    const pendingHeader = workbook.getWorksheet(DDP_EXCEL_SHEET_PENDING)?.getRow(1);
    expect(pendingHeader?.getCell(1).fill).toMatchObject({
      fgColor: { argb: "FFEBF4F4" },
    });
    expect(pendingHeader?.getCell(4).fill).toMatchObject({
      fgColor: { argb: "FFDCE6F1" },
    });

    const pendingDataRow = workbook.getWorksheet(DDP_EXCEL_SHEET_PENDING)?.getRow(2);
    expect(pendingDataRow?.getCell(3).fill).toMatchObject({
      fgColor: { argb: "FFFFFF00" },
    });
    expect(pendingDataRow?.getCell(1).value).toMatchObject({
      hyperlink: expect.stringContaining("woID=1"),
    });
  });
});

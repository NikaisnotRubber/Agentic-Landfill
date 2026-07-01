import { describe, expect, it } from "vitest";

import {
  getMappingExcelHeaders,
  loadMappingExportSchema,
} from "../../platform/contract/loadMappingExportSchema";

describe("mappingExportSchema contract", () => {
  it("loads 19 mapping export columns in stable order", async () => {
    const schema = await loadMappingExportSchema();
    expect(schema.version).toBe("1.0.0");
    expect(schema.columns).toHaveLength(19);
    expect(getMappingExcelHeaders(schema)[0]).toBe("AD Account");
    expect(getMappingExcelHeaders(schema).at(-1)).toBe("Location");
  });

  it("marks Host IP as mapping-only (D-TICKET-01 excluded from ticket workbook)", async () => {
    const schema = await loadMappingExportSchema();
    const hostIp = schema.columns.find((column) => column.excelHeader === "Host IP");
    expect(hostIp?.inTicketWorkbook).toBe(false);
    expect(hostIp?.decisionId).toBe("D-TICKET-01");
    expect(hostIp?.dbColumn).toBe("host_ip");
  });

  it("lists ticket-only columns separately from mapping_row", async () => {
    const schema = await loadMappingExportSchema();
    expect(schema.ticketOnlyColumns.map((column) => column.excelHeader)).toEqual([
      "Ticket ID",
      "異常",
      "工單狀態",
    ]);
  });
});

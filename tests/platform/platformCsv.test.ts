import { describe, expect, it } from "vitest";

import { parseCsvRecords } from "../../platform/io/csv";

describe("parseCsvRecords", () => {
  it("parses BOM CSV records with headers, trimmed cells, and skipped blank rows", () => {
    const records = parseCsvRecords("\uFEFFAccount,Role\r\n LEO.ZOU , Admin \r\n\r\n");

    expect(records).toEqual([{ Account: "LEO.ZOU", Role: "Admin" }]);
  });
});

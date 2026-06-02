import { describe, expect, it } from "vitest";

import { processDdpTickets } from "../server/ddp/processDdpTickets";
import type { ProcessedDdpRow, ProcessedDdpSummary } from "../server/ddp/types";

describe("processed DDP types", () => {
  it("allow the core row fields used by the UI", () => {
    const row: ProcessedDdpRow = {
      ticketId: "822184",
      status: "Open",
      subject: "[DDP] New Member-AD account name",
      requester: "LEO.ZOU 鄒皓年",
      isNewTicket: true,
      adAccount: "LEO.ZOU",
      adName: "鄒皓年",
      firstName: "LEO",
      lastName: "ZOU",
      mail: "LEO.ZOU@DELTAWW.COM",
      bu: "",
      nbHostname: "TWCL1NB5308",
      vmHostname: "TWPJRDPSCNLT05",
      role: "",
      application: "",
      userRoles: "",
      abnormalFlags: [],
    };

    const summary: ProcessedDdpSummary = {
      totalRows: 1,
      abnormalRowCount: 0,
      newTicketCount: 1,
    };

    expect(row.ticketId).toBe("822184");
    expect(summary.newTicketCount).toBe(1);
  });
});

describe("processDdpTickets", () => {
  it("adds new-ticket flags and summary counts across the batch", () => {
    const result = processDdpTickets(
      [
        {
          id: "822230",
          subject: "DDP A",
          requester: "A.USER 測試員",
          technician: "",
          created_time: "",
          site: "",
          category: "",
          status: "Open",
          group: "",
          short_description: "電腦編號(NB): TWCL1NB1234",
        },
      ],
      new Set(["822230"]),
    );

    expect(result.rows[0]?.isNewTicket).toBe(true);
    expect(result.summary.totalRows).toBe(1);
    expect(result.summary.newTicketCount).toBe(1);
    expect(result.rows[0]?.nbHostname).toBe("TWCL1NB1234");
  });
});

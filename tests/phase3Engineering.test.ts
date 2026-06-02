import { describe, expect, it } from "vitest";

import { parseDdpTicket } from "../server/ddp/parseDdpTicket";
import { processDdpTickets } from "../server/ddp/processDdpTickets";
import processedContract from "./fixtures/processed-payload-contract.json" with { type: "json" };

describe("resolveEffectiveAdAccount", () => {
  it("does not flag missing-ad when ticket.ad already has an account", () => {
    const row = parseDdpTicket({
      id: "1",
      status: "Open",
      subject: "DDP",
      requester: "LEO.ZOU 鄒皓年",
      technician: "",
      created_time: "",
      site: "",
      category: "",
      group: "",
      short_description: "",
      ad: {
        status: "lookup-failed",
        adAccount: "LEO.ZOU",
        displayName: "",
        mail: "leo.zou@deltaww.com",
        department: "",
        manager: "",
        managerAccount: "",
        employeeId: "",
        bg: "",
        bu: "",
        error: "timeout",
      },
    });

    expect(row.adAccount).toBe("LEO.ZOU");
    expect(row.abnormalFlags).not.toContain("missing-ad-account");
  });
});

describe("processed payload contract", () => {
  it("matches the golden processed row shape", () => {
    const { rows } = processDdpTickets(
      [processedContract.ticket as never],
      new Set(),
    );
    const row = rows[0]!;

    for (const key of processedContract.requiredRowFields) {
      expect(row).toHaveProperty(key);
    }

    expect(row.ticketId).toBe(processedContract.ticket.id);
    expect(row.nbHostname).toBe(processedContract.expected.nbHostname);
    expect(row.abnormalFlags).toEqual(processedContract.expected.abnormalFlags);
  });
});

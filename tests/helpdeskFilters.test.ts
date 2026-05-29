import { describe, expect, it } from "vitest";

import {
  filterTicketsForDdp,
  isDdpSubject,
} from "../server/helpdeskFilters";
import type { TicketRecord } from "../server/types";

describe("isDdpSubject", () => {
  it("matches subjects containing uppercase DDP", () => {
    expect(isDdpSubject("[DDP] New Member-AD account name")).toBe(true);
    expect(isDdpSubject("Prefix DDP suffix")).toBe(true);
  });

  it("does not match lowercase or mixed-case variants", () => {
    expect(isDdpSubject("[ddp] New Member-AD account name")).toBe(false);
    expect(isDdpSubject("[Ddp] New Member-AD account name")).toBe(false);
    expect(isDdpSubject("No match here")).toBe(false);
  });
});

describe("filterTicketsForDdp", () => {
  it("keeps only tickets whose subject contains uppercase DDP", () => {
    const tickets: TicketRecord[] = [
      {
        id: "1",
        subject: "[DDP] New Member-AD account name",
        requester: "REQ 1",
        technician: "TECH 1",
        created_time: "24/04/2026 04:35 PM",
        site: "Site 1",
        category: "Category 1",
        status: "Closed",
        group: "IT-DDP",
        short_description: "Description 1",
      },
      {
        id: "2",
        subject: "[ddp] should be filtered out",
        requester: "REQ 2",
        technician: "TECH 2",
        created_time: "24/04/2026 04:36 PM",
        site: "Site 2",
        category: "Category 2",
        status: "Closed",
        group: "IT-DDP",
        short_description: "Description 2",
      },
      {
        id: "3",
        subject: "General helpdesk request",
        requester: "REQ 3",
        technician: "TECH 3",
        created_time: "24/04/2026 04:37 PM",
        site: "Site 3",
        category: "Category 3",
        status: "Open",
        group: "IT",
        short_description: "Description 3",
      },
    ];

    expect(filterTicketsForDdp(tickets)).toEqual([tickets[0]]);
  });
});

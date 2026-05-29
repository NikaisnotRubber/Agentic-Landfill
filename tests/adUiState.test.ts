import { describe, expect, it } from "vitest";

import {
  canEnrichCurrentTickets,
  canFetchAndEnrichTickets,
} from "../src/lib/adEnrichment";

function createSuccessResult() {
  return {
    ok: true as const,
    source: "sample" as const,
    count: 1,
    tickets: [
      {
        id: "1",
        subject: "DDP access request",
        requester: "JIAHUA.WU 吳家驊",
        technician: "",
        created_time: "",
        site: "",
        category: "",
        status: "",
        group: "",
        short_description: "",
      },
    ],
  };
}

describe("canFetchAndEnrichTickets", () => {
  it("allows fetch-and-enrich while the UI is idle", () => {
    expect(canFetchAndEnrichTickets(false, false)).toBe(true);
  });

  it("blocks fetch-and-enrich while fetching or enriching", () => {
    expect(canFetchAndEnrichTickets(true, false)).toBe(false);
    expect(canFetchAndEnrichTickets(false, true)).toBe(false);
  });
});

describe("canEnrichCurrentTickets", () => {
  it("returns false when there is no current result set", () => {
    expect(canEnrichCurrentTickets(null, false, false)).toBe(false);
  });

  it("returns false while a fetch or enrichment request is in flight", () => {
    const result = createSuccessResult();

    expect(canEnrichCurrentTickets(result, true, false)).toBe(false);
    expect(canEnrichCurrentTickets(result, false, true)).toBe(false);
  });

  it("returns true only when tickets exist and the UI is idle", () => {
    const result = createSuccessResult();

    expect(canEnrichCurrentTickets(result, false, false)).toBe(true);
  });
});

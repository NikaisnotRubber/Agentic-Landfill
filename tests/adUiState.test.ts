import { describe, expect, it } from "vitest";

import { canEnrichCurrentTickets } from "../src/lib/adEnrichment";

describe("canEnrichCurrentTickets", () => {
  it("returns false when there is no current result set", () => {
    expect(canEnrichCurrentTickets(null, false, false)).toBe(false);
  });

  it("returns false while a fetch or enrichment request is in flight", () => {
    const result = {
      ok: true as const,
      source: "sample" as const,
      count: 1,
      tickets: [
        {
          id: "1",
          subject: "",
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

    expect(canEnrichCurrentTickets(result, true, false)).toBe(false);
    expect(canEnrichCurrentTickets(result, false, true)).toBe(false);
  });

  it("returns true only when tickets exist and the UI is idle", () => {
    const result = {
      ok: true as const,
      source: "sample" as const,
      count: 1,
      tickets: [
        {
          id: "1",
          subject: "",
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

    expect(canEnrichCurrentTickets(result, false, false)).toBe(true);
  });
});

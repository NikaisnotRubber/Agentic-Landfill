import { describe, expect, it } from "vitest";

import { rebuildProcessedPayload } from "../server/ddp/rebuildProcessedPayload";

describe("rebuildProcessedPayload", () => {
  it("rebuilds processed rows from enriched tickets and clears missing-ad-account", () => {
    const tickets = [
      {
        id: "1",
        subject: "DDP",
        requester: "JIAHUA.WU 吳家驊",
        technician: "",
        created_time: "",
        site: "",
        category: "",
        status: "Open",
        group: "",
        short_description: "電腦編號 (NB): TWCL1NB1234",
        ad: {
          status: "enriched" as const,
          adAccount: "JIAHUA.WU",
          displayName: "吳家驊",
          mail: "jiahua.wu@deltaww.com",
          department: "",
          manager: "",
          managerAccount: "",
          employeeId: "",
          bg: "LTW",
          bu: "IT",
        },
      },
    ];

    const previous = rebuildProcessedPayload(tickets);
    expect(previous.processedRows?.[0]?.adAccount).toBe("JIAHUA.WU");
    expect(previous.processedRows?.[0]?.adName).toBe("吳家驊");
    expect(previous.processedRows?.[0]?.abnormalFlags).not.toContain("missing-ad-account");
    expect(previous.processedRows?.[0]?.nbHostname).toBe("TWCL1NB1234");
  });
});

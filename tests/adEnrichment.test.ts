import { describe, expect, it, vi } from "vitest";

import { enrichTicketsWithAd } from "../server/ad/enrichTicketsWithAd";

describe("enrichTicketsWithAd", () => {
  it("deduplicates requester accounts and merges AD results onto tickets", async () => {
    const lookupUser = vi.fn().mockResolvedValue({
      adAccount: "JIAHUA.WU",
      displayName: "吳家驊",
      mail: "",
      department: "",
      manager: "王小明",
      employeeId: "",
      bg: "LTW",
      bu: "IT",
    });

    const result = await enrichTicketsWithAd(
      [
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
        {
          id: "2",
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
      {
        lookupUser,
        close: vi.fn().mockResolvedValue(undefined),
      },
    );

    expect(lookupUser).toHaveBeenCalledTimes(1);
    expect(result.summary.enrichedCount).toBe(2);
    expect(result.summary.uniqueAccounts).toBe(1);
    expect(result.tickets[0].ad).toMatchObject({
      status: "enriched",
      manager: "王小明",
      bg: "LTW",
      bu: "IT",
    });
  });

  it("marks missing requester and lookup failures without aborting the whole batch", async () => {
    const lookupUser = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error("lookup timeout"));

    const result = await enrichTicketsWithAd(
      [
        {
          id: "1",
          subject: "",
          requester: "",
          technician: "",
          created_time: "",
          site: "",
          category: "",
          status: "",
          group: "",
          short_description: "",
        },
        {
          id: "2",
          subject: "",
          requester: "NOT.FOUND 測試員",
          technician: "",
          created_time: "",
          site: "",
          category: "",
          status: "",
          group: "",
          short_description: "",
        },
        {
          id: "3",
          subject: "",
          requester: "BROKEN.USER 測試員",
          technician: "",
          created_time: "",
          site: "",
          category: "",
          status: "",
          group: "",
          short_description: "",
        },
      ],
      {
        lookupUser,
        close: vi.fn().mockResolvedValue(undefined),
      },
    );

    expect(result.summary.missingRequesterCount).toBe(1);
    expect(result.summary.notFoundCount).toBe(1);
    expect(result.summary.lookupFailedCount).toBe(1);
    expect(result.tickets[0].ad?.status).toBe("missing-requester");
    expect(result.tickets[1].ad?.status).toBe("not-found");
    expect(result.tickets[2].ad?.status).toBe("lookup-failed");
  });
});

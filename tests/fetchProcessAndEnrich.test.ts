import { describe, expect, it, vi } from "vitest";

import { fetchProcessAndEnrich } from "../server/fetchProcessAndEnrich";

describe("fetchProcessAndEnrich", () => {
  it("returns processed rows and tracker summary for successful fetches", async () => {
    const result = await fetchProcessAndEnrich(
      { count: 5 },
      { persistTracker: true },
      {
        fetchTickets: vi.fn().mockResolvedValue({
          ok: true,
          source: "live",
          count: 1,
          tickets: [
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
        }),
        detectNewTickets: vi.fn().mockResolvedValue({
          newTicketIds: ["822230"],
          summary: {
            latestSeenId: "822230",
            previousSeenId: undefined,
            newTicketCount: 1,
          },
        }),
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.processedRows).toHaveLength(1);
    expect(result.processedSummary?.newTicketCount).toBe(1);
    expect(result.processedRows?.[0]?.isNewTicket).toBe(true);
  });
});

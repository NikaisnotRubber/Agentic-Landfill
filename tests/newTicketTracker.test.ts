import { describe, expect, it } from "vitest";

import { detectNewTickets } from "../server/ddp/newTicketTracker";

describe("detectNewTickets", () => {
  it("initializes the tracker when no prior id exists", async () => {
    const result = await detectNewTickets(
      [
        { id: "822230", subject: "DDP A" },
        { id: "822184", subject: "DDP B" },
      ],
      {
        readTracker: async () => "",
        writeTracker: async () => undefined,
      },
    );

    expect(result.newTicketIds).toEqual(["822230"]);
    expect(result.summary.latestSeenId).toBe("822230");
  });

  it("returns a warning when the previous id is absent from the batch", async () => {
    const result = await detectNewTickets(
      [
        { id: "822230", subject: "DDP A" },
        { id: "822184", subject: "DDP B" },
      ],
      {
        readTracker: async () => "700000",
        writeTracker: async () => undefined,
      },
    );

    expect(result.newTicketIds).toEqual([]);
    expect(result.summary.trackerWarning).toContain("not found");
  });
});

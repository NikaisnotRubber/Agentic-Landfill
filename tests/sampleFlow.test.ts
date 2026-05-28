import { describe, expect, it } from "vitest";

import { readSampleTickets } from "../server/sampleTickets";

describe("readSampleTickets", () => {
  it("loads the checked-in sample ticket JSON and returns normalized rows", async () => {
    const result = await readSampleTickets();

    expect(result.source).toBe("sample");
    expect(result.tickets.length).toBeGreaterThan(0);
    expect(result.tickets[0]).toMatchObject({
      id: expect.any(String),
      subject: expect.any(String),
      requester: expect.any(String),
      technician: expect.any(String),
      status: expect.any(String),
    });
  });
});

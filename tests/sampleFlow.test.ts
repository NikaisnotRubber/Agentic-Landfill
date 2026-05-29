import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("readSampleTickets", () => {
  it("loads the checked-in sample ticket JSON and returns normalized rows", async () => {
    const originalCwd = process.cwd();
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "sample-flow-"));

    try {
      process.chdir(tempDir);

      const { readSampleTickets } = await import("../server/sampleTickets.ts?cwd-proof");
      const result = await readSampleTickets();

      expect(result.ok).toBe(true);
      expect(result.source).toBe("sample");
      expect(result.tickets.length).toBeGreaterThan(0);
      expect(result.count).toBe(result.tickets.length);
      expect(result.tickets.every((ticket) => ticket.subject.includes("DDP"))).toBe(
        true,
      );
      expect(result.tickets[0]).toMatchObject({
        id: expect.any(String),
        subject: expect.any(String),
        requester: expect.any(String),
        technician: expect.any(String),
        status: expect.any(String),
      });
    } finally {
      process.chdir(originalCwd);
    }
  });
});

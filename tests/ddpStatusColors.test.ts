import { describe, expect, it } from "vitest";

import { getTicketStatusTone } from "../server/ddp/statusColors";

describe("getTicketStatusTone", () => {
  it("maps open to the warm tone", () => {
    expect(getTicketStatusTone("Open")).toBe("open");
    expect(getTicketStatusTone("open")).toBe("open");
  });

  it("maps closed and resolved to their own tones", () => {
    expect(getTicketStatusTone("Closed")).toBe("closed");
    expect(getTicketStatusTone("resolved")).toBe("resolved");
  });

  it("returns neutral for unsupported statuses", () => {
    expect(getTicketStatusTone("Onhold")).toBe("neutral");
    expect(getTicketStatusTone("")).toBe("neutral");
  });
});

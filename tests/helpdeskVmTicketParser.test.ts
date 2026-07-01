import { describe, expect, it } from "vitest";

import { extractRequesterAccount } from "../server/ad/requesterParser";
import { parseHelpdeskTicketForVmSync } from "../server/vmMaster/helpdeskTicketParser";
import type { TicketRecord } from "../server/types";

function ticket(overrides: Partial<TicketRecord>): TicketRecord {
  return {
    id: "836395",
    subject: "",
    requester: "",
    technician: "",
    created_time: "",
    site: "",
    category: "",
    status: "",
    group: "",
    short_description: "",
    ...overrides,
  };
}

describe("Helpdesk VM ticket account parser", () => {
  it("drops a decoded single digit suffix before Chinese requester names", () => {
    expect(extractRequesterAccount("UNO.CHEN2 \u9673\u653f\u5609")).toBe("UNO.CHEN");
  });

  it("drops a decoded single digit suffix before Chinese description names", () => {
    expect(
      parseHelpdeskTicketForVmSync(
        ticket({
          requester: "fallback",
          short_description: "AD Account: UNO.CHEN2 \u9673\u653f\u5609",
        }),
      ),
    ).toMatchObject({
      ok: true,
      adName: "UNO.CHEN",
    });
  });
});

import { describe, expect, it, vi } from "vitest";

import { createEnrichAdHandler } from "../server/ad/enrichAdRoute";

function createMockResponse() {
  return {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: "",
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
    end(payload: string) {
      this.body = payload;
    },
  };
}

describe("createEnrichAdHandler", () => {
  it("rejects non-POST requests", async () => {
    const handler = createEnrichAdHandler({
      readBody: vi.fn(),
      createLookupClient: vi.fn(),
    });
    const response = createMockResponse();

    await handler({ method: "GET" } as never, response as never);

    expect(response.statusCode).toBe(405);
    expect(JSON.parse(response.body)).toMatchObject({
      ok: false,
      error: "Method not allowed",
    });
  });

  it("returns an enriched ticket payload for POST requests", async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const handler = createEnrichAdHandler({
      readBody: vi.fn().mockResolvedValue(
        JSON.stringify({
          source: "sample",
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
        }),
      ),
      createLookupClient: vi.fn().mockReturnValue({
        lookupUser: vi.fn().mockResolvedValue({
          adAccount: "JIAHUA.WU",
          displayName: "吳家驊",
          mail: "",
          department: "",
          manager: "王小明",
          employeeId: "",
          bg: "LTW",
          bu: "IT",
        }),
        close,
      }),
    });
    const response = createMockResponse();

    await handler({ method: "POST" } as never, response as never);

    const payload = JSON.parse(response.body);
    expect(response.statusCode).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.source).toBe("sample");
    expect(payload.adSummary.enrichedCount).toBe(1);
    expect(payload.tickets[0].ad.manager).toBe("王小明");
    expect(close).toHaveBeenCalledTimes(1);
  });
});

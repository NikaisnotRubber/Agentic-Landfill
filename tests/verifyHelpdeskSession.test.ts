import { describe, expect, it, vi } from "vitest";

import { verifyHelpdeskSession } from "../server/auth/verifyHelpdeskSession";

function createBrowserWithPayload(payload: unknown) {
  const close = vi.fn().mockResolvedValue(undefined);
  const page = {
    goto: vi.fn().mockResolvedValue(undefined),
    evaluate: vi.fn().mockResolvedValue({
      httpStatus: 200,
      json: payload,
    }),
  };
  const context = {
    newPage: vi.fn().mockResolvedValue(page),
    close,
  };
  const browser = {
    newContext: vi.fn().mockResolvedValue(context),
  };

  return { browser, context, page };
}

describe("verifyHelpdeskSession", () => {
  it("accepts a payload with requests", async () => {
    const { browser, context } = createBrowserWithPayload({ requests: [] });

    await expect(
      verifyHelpdeskSession({
        browser: browser as never,
        stateFile: "state.json",
      }),
    ).resolves.toEqual({ ok: true });

    expect(browser.newContext).toHaveBeenCalledWith({ storageState: "state.json" });
    expect(context.close).toHaveBeenCalledTimes(1);
  });

  it("rejects auth-failure payloads", async () => {
    const { browser } = createBrowserWithPayload({
      response_status: {
        messages: [{ status_code: 401 }],
      },
    });

    await expect(
      verifyHelpdeskSession({
        browser: browser as never,
        stateFile: "state.json",
      }),
    ).rejects.toThrow("Saved storage state is not authenticated.");
  });

  it("rejects malformed API responses", async () => {
    const { browser } = createBrowserWithPayload({ hello: "world" });

    await expect(
      verifyHelpdeskSession({
        browser: browser as never,
        stateFile: "state.json",
      }),
    ).rejects.toThrow("Helpdesk API validation did not return requests.");
  });
});

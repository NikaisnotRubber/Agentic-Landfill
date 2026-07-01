import { afterEach, describe, expect, it, vi } from "vitest";

import { requestJson } from "../src/lib/http";

describe("requestJson", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns parsed JSON for GET requests", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, value: 1 }))),
    );

    await expect(requestJson<{ ok: true; value: number }>("/api/test")).resolves.toEqual({
      ok: true,
      value: 1,
    });
  });

  it("sends JSON payloads for POST requests", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    vi.stubGlobal("fetch", fetchMock);

    await requestJson("/api/test", { method: "POST", body: { count: 25 } });

    expect(fetchMock).toHaveBeenCalledWith("/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count: 25 }),
    });
  });

  it("turns impossible ok payloads from failed responses into errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 500 }),
      ),
    );

    await expect(
      requestJson<{ ok: true } | { ok: false; error: string }>("/api/test", {}, "Test request"),
    ).resolves.toEqual({ ok: false, error: "Test request failed with 500" });
  });
});

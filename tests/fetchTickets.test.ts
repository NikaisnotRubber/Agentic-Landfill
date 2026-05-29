import { describe, expect, it, vi } from "vitest";

import { fetchTickets } from "../server/fetchTickets";

describe("fetchTickets auth refresh", () => {
  it("returns live tickets without triggering login when the first fetch succeeds", async () => {
    const ensureHelpdeskSession = vi.fn().mockResolvedValue(undefined);
    const executeTicketFetch = vi.fn().mockResolvedValue({
      httpStatus: 200,
      json: {
        response_status: [{ status_code: 2000, status: "success" }],
        requests: [
          {
            id: "817742",
            subject: "DDP software install",
            technician: { name: "ALVIS.MC.TSAO 曹閔丞" },
          },
        ],
      },
    });
    const loginAndSaveState = vi.fn();

    const result = await fetchTickets(
      { count: 1, stateFile: "/tmp/state.json" },
      { ensureHelpdeskSession, executeTicketFetch, loginAndSaveState },
    );

    expect(result).toMatchObject({
      ok: true,
      source: "live",
      count: 1,
      tickets: [
        {
          id: "817742",
          subject: "DDP software install",
          technician: "ALVIS.MC.TSAO 曹閔丞",
        },
      ],
    });
    expect(ensureHelpdeskSession).toHaveBeenCalledTimes(1);
    expect(ensureHelpdeskSession).toHaveBeenCalledWith({
      stateFile: "/tmp/state.json",
      baseUrl: "https://ithelpdesk.deltaww.com/WOListView.do",
    });
    expect(loginAndSaveState).not.toHaveBeenCalled();
    expect(executeTicketFetch).toHaveBeenCalledTimes(1);
    expect(executeTicketFetch).toHaveBeenCalledWith({
      stateFile: "/tmp/state.json",
      targetUrl: expect.stringContaining("/api/v3/requests"),
      baseUrl: "https://ithelpdesk.deltaww.com/WOListView.do",
    });
  });

  it("keeps only DDP-subject tickets after a successful live fetch", async () => {
    const ensureHelpdeskSession = vi.fn().mockResolvedValue(undefined);
    const executeTicketFetch = vi.fn().mockResolvedValue({
      httpStatus: 200,
      json: {
        response_status: [{ status_code: 2000, status: "success" }],
        requests: [
          {
            id: "817742",
            subject: "DDP laptop replacement",
            technician: { name: "ALVIS.MC.TSAO 曹閔丞" },
          },
          {
            id: "817743",
            subject: "Printer setup",
            technician: { name: "ALVIS.MC.TSAO 曹閔丞" },
          },
        ],
      },
    });
    const loginAndSaveState = vi.fn();

    const result = await fetchTickets(
      { count: 2, stateFile: "/tmp/state.json" },
      { ensureHelpdeskSession, executeTicketFetch, loginAndSaveState },
    );

    expect(result).toMatchObject({
      ok: true,
      source: "live",
      count: 1,
      tickets: [
        {
          id: "817742",
          subject: "DDP laptop replacement",
          technician: "ALVIS.MC.TSAO 曹閔丞",
        },
      ],
    });
    expect(loginAndSaveState).not.toHaveBeenCalled();
  });

  it("refreshes login once and retries when the first API response is an auth failure", async () => {
    const ensureHelpdeskSession = vi.fn().mockResolvedValue(undefined);
    const executeTicketFetch = vi
      .fn()
      .mockResolvedValueOnce({
        httpStatus: 200,
        json: {
          response_status: {
            status_code: 4000,
            status: "failed",
            messages: [{ status_code: 401, message: "AuthToken invalid" }],
          },
        },
      })
      .mockResolvedValueOnce({
        httpStatus: 200,
        json: {
          response_status: [{ status_code: 2000, status: "success" }],
          requests: [
          {
            id: "817742",
            subject: "DDP recovered ticket",
            technician: { name: "ALVIS.MC.TSAO 曹閔丞" },
          },
          ],
        },
      });
    const loginAndSaveState = vi.fn().mockResolvedValue({
      ok: true,
      stateFile: "/tmp/state.json",
      baseUrl: "https://ithelpdesk.deltaww.com/",
    });

    const result = await fetchTickets(
      { count: 1, stateFile: "/tmp/state.json" },
      { ensureHelpdeskSession, executeTicketFetch, loginAndSaveState },
    );

    expect(result).toMatchObject({
      ok: true,
      source: "live",
      count: 1,
      tickets: [
        {
          id: "817742",
          subject: "DDP recovered ticket",
        },
      ],
    });
    expect(loginAndSaveState).toHaveBeenCalledTimes(1);
    expect(loginAndSaveState).toHaveBeenCalledWith({
      configPath: expect.stringMatching(/config\/helpdesk-auth\.yaml$/),
      stateFile: "/tmp/state.json",
      baseUrl: "https://ithelpdesk.deltaww.com/WOListView.do",
    });
    expect(executeTicketFetch).toHaveBeenCalledTimes(2);
  });

  it("uses refreshed stateFile and baseUrl for the retry when refresh returns different values", async () => {
    const ensureHelpdeskSession = vi.fn().mockResolvedValue(undefined);
    const executeTicketFetch = vi
      .fn()
      .mockResolvedValueOnce({
        httpStatus: 200,
        json: {
          response_status: {
            status_code: 4000,
            status: "failed",
            messages: [{ status_code: 401, message: "AuthToken invalid" }],
          },
        },
      })
      .mockResolvedValueOnce({
        httpStatus: 200,
        json: {
          response_status: [{ status_code: 2000, status: "success" }],
          requests: [],
        },
      });
    const loginAndSaveState = vi.fn().mockResolvedValue({
      ok: true,
      stateFile: "/tmp/refreshed-state.json",
      baseUrl: "https://refreshed.example.com/app",
    });

    await fetchTickets(
      {
        count: 1,
        stateFile: "/tmp/original-state.json",
        baseUrl: "https://original.example.com/app",
      },
      { ensureHelpdeskSession, executeTicketFetch, loginAndSaveState },
    );

    expect(executeTicketFetch).toHaveBeenNthCalledWith(1, {
      stateFile: "/tmp/original-state.json",
      targetUrl: expect.stringContaining("/api/v3/requests"),
      baseUrl: "https://original.example.com/app",
    });
    expect(executeTicketFetch).toHaveBeenNthCalledWith(2, {
      stateFile: "/tmp/refreshed-state.json",
      targetUrl: expect.stringContaining("/api/v3/requests"),
      baseUrl: "https://refreshed.example.com/app",
    });
  });

  it.each([401, 403])(
    "refreshes login when the first API response is HTTP %i without the auth-failure payload shape",
    async (httpStatus) => {
      const ensureHelpdeskSession = vi.fn().mockResolvedValue(undefined);
      const executeTicketFetch = vi
        .fn()
        .mockResolvedValueOnce({
          httpStatus,
          json: {
            message: "Unauthorized",
          },
        })
        .mockResolvedValueOnce({
          httpStatus: 200,
          json: {
            response_status: [{ status_code: 2000, status: "success" }],
            requests: [
              {
                id: "817744",
                subject: "DDP access restored",
                technician: { name: "ALVIS.MC.TSAO 曹閔丞" },
              },
            ],
          },
        });
      const loginAndSaveState = vi.fn().mockResolvedValue({
        ok: true,
        stateFile: "/tmp/state.json",
        baseUrl: "https://ithelpdesk.deltaww.com/",
      });

      const result = await fetchTickets(
        { count: 1, stateFile: "/tmp/state.json" },
        { ensureHelpdeskSession, executeTicketFetch, loginAndSaveState },
      );

      expect(result).toMatchObject({
        ok: true,
        source: "live",
        count: 1,
        tickets: [{ id: "817744", subject: "DDP access restored" }],
      });
      expect(loginAndSaveState).toHaveBeenCalledTimes(1);
      expect(executeTicketFetch).toHaveBeenCalledTimes(2);
    },
  );

  it("preserves caller-supplied stateFile and baseUrl across bootstrap and refresh", async () => {
    const ensureHelpdeskSession = vi.fn().mockResolvedValue(undefined);
    const executeTicketFetch = vi
      .fn()
      .mockResolvedValueOnce({
        httpStatus: 200,
        json: {
          response_status: {
            status_code: 4000,
            status: "failed",
            messages: [{ status_code: 401, message: "AuthToken invalid" }],
          },
        },
      })
      .mockResolvedValueOnce({
        httpStatus: 200,
        json: {
          response_status: [{ status_code: 2000, status: "success" }],
          requests: [],
        },
      });
    const loginAndSaveState = vi.fn().mockResolvedValue({
      ok: true,
      stateFile: "/tmp/original-state.json",
      baseUrl: "https://original.example.com/app",
    });

    await fetchTickets(
      {
        count: 1,
        stateFile: "/tmp/original-state.json",
        baseUrl: "https://original.example.com/app",
      },
      { ensureHelpdeskSession, executeTicketFetch, loginAndSaveState },
    );

    expect(ensureHelpdeskSession).toHaveBeenCalledWith({
      stateFile: "/tmp/original-state.json",
      baseUrl: "https://original.example.com/app",
    });
    expect(loginAndSaveState).toHaveBeenCalledWith({
      configPath: expect.stringMatching(/config\/helpdesk-auth\.yaml$/),
      stateFile: "/tmp/original-state.json",
      baseUrl: "https://original.example.com/app",
    });
  });

  it("fails with a clear error when the refreshed session is still unauthorized", async () => {
    const unauthorizedPayload = {
      response_status: {
        status_code: 4000,
        status: "failed",
        messages: [{ status_code: 401, message: "AuthToken invalid" }],
      },
    };
    const ensureHelpdeskSession = vi.fn().mockResolvedValue(undefined);
    const executeTicketFetch = vi.fn().mockResolvedValue({
      httpStatus: 200,
      json: unauthorizedPayload,
    });
    const loginAndSaveState = vi.fn().mockResolvedValue({
      ok: true,
      stateFile: "/tmp/state.json",
      baseUrl: "https://ithelpdesk.deltaww.com/",
    });

    const result = await fetchTickets(
      { count: 1, stateFile: "/tmp/state.json" },
      { ensureHelpdeskSession, executeTicketFetch, loginAndSaveState },
    );

    expect(result).toEqual({
      ok: false,
      source: "live",
      error: "Helpdesk session refresh succeeded but API still reports unauthorized access.",
      details: unauthorizedPayload,
    });
    expect(loginAndSaveState).toHaveBeenCalledTimes(1);
    expect(executeTicketFetch).toHaveBeenCalledTimes(2);
  });

  it("reuses the same normalization path after a retry and preserves technician filtering", async () => {
    const ensureHelpdeskSession = vi.fn().mockResolvedValue(undefined);
    const executeTicketFetch = vi
      .fn()
      .mockResolvedValueOnce({
        httpStatus: 200,
        json: {
          response_status: {
            status_code: 4000,
            status: "failed",
            messages: [{ status_code: 401, message: "AuthToken invalid" }],
          },
        },
      })
      .mockResolvedValueOnce({
        httpStatus: 200,
        json: {
          response_status: [{ status_code: 2000, status: "success" }],
          requests: [
            {
              id: "1",
              subject: "DDP keep me",
              technician: { name: " ALVIS.MC.TSAO 曹閔丞 " },
            },
            {
              id: "2",
              subject: "Filter me",
              technician: { name: "OTHER TECH" },
            },
          ],
        },
      });
    const loginAndSaveState = vi.fn().mockResolvedValue({
      ok: true,
      stateFile: "/tmp/state.json",
      baseUrl: "https://ithelpdesk.deltaww.com/",
    });

    const result = await fetchTickets(
      {
        count: 2,
        stateFile: "/tmp/state.json",
        technician: "ALVIS.MC.TSAO 曹閔丞",
      },
      { ensureHelpdeskSession, executeTicketFetch, loginAndSaveState },
    );

    expect(result).toMatchObject({
      ok: true,
      source: "live",
      count: 1,
      tickets: [{ id: "1", subject: "DDP keep me" }],
    });
  });

  it("treats whitespace-only technician input as no technician filter", async () => {
    const ensureHelpdeskSession = vi.fn().mockResolvedValue(undefined);
    const executeTicketFetch = vi.fn().mockResolvedValue({
      httpStatus: 200,
      json: {
        response_status: [{ status_code: 2000, status: "success" }],
        requests: [
          {
            id: "1",
            subject: "DDP keep me",
            technician: { name: "ALVIS.MC.TSAO 曹閔丞" },
          },
          {
            id: "2",
            subject: "DDP keep me too",
            technician: { name: "OTHER TECH" },
          },
        ],
      },
    });
    const loginAndSaveState = vi.fn();

    const result = await fetchTickets(
      {
        count: 2,
        stateFile: "/tmp/state.json",
        technician: "   ",
      },
      { ensureHelpdeskSession, executeTicketFetch, loginAndSaveState },
    );

    expect(result).toMatchObject({
      ok: true,
      source: "live",
      count: 2,
      tickets: [
        { id: "1", subject: "DDP keep me" },
        { id: "2", subject: "DDP keep me too" },
      ],
    });
  });

  it("returns a failure when ensureHelpdeskSession throws", async () => {
    const ensureHelpdeskSession = vi
      .fn()
      .mockRejectedValue(new Error("session bootstrap failed"));
    const executeTicketFetch = vi.fn();
    const loginAndSaveState = vi.fn();

    const result = await fetchTickets(
      { count: 1, stateFile: "/tmp/state.json" },
      { ensureHelpdeskSession, executeTicketFetch, loginAndSaveState },
    );

    expect(result).toEqual({
      ok: false,
      source: "live",
      error: "session bootstrap failed",
    });
    expect(executeTicketFetch).not.toHaveBeenCalled();
    expect(loginAndSaveState).not.toHaveBeenCalled();
  });

  it("returns a failure when loginAndSaveState throws during auth refresh", async () => {
    const ensureHelpdeskSession = vi.fn().mockResolvedValue(undefined);
    const executeTicketFetch = vi.fn().mockResolvedValue({
      httpStatus: 200,
      json: {
        response_status: {
          status_code: 4000,
          status: "failed",
          messages: [{ status_code: 401, message: "AuthToken invalid" }],
        },
      },
    });
    const loginAndSaveState = vi
      .fn()
      .mockRejectedValue(new Error("refresh login failed"));

    const result = await fetchTickets(
      { count: 1, stateFile: "/tmp/state.json" },
      { ensureHelpdeskSession, executeTicketFetch, loginAndSaveState },
    );

    expect(result).toEqual({
      ok: false,
      source: "live",
      error: "refresh login failed",
    });
    expect(executeTicketFetch).toHaveBeenCalledTimes(1);
  });

  it("returns a failure when the second fetch throws after refresh", async () => {
    const ensureHelpdeskSession = vi.fn().mockResolvedValue(undefined);
    const executeTicketFetch = vi
      .fn()
      .mockResolvedValueOnce({
        httpStatus: 200,
        json: {
          response_status: {
            status_code: 4000,
            status: "failed",
            messages: [{ status_code: 401, message: "AuthToken invalid" }],
          },
        },
      })
      .mockRejectedValueOnce(new Error("retry fetch failed"));
    const loginAndSaveState = vi.fn().mockResolvedValue({
      ok: true,
      stateFile: "/tmp/refreshed-state.json",
      baseUrl: "https://refreshed.example.com/app",
    });

    const result = await fetchTickets(
      { count: 1, stateFile: "/tmp/state.json" },
      { ensureHelpdeskSession, executeTicketFetch, loginAndSaveState },
    );

    expect(result).toEqual({
      ok: false,
      source: "live",
      error: "retry fetch failed",
    });
    expect(loginAndSaveState).toHaveBeenCalledTimes(1);
    expect(executeTicketFetch).toHaveBeenCalledTimes(2);
  });

  it("returns an HTTP failure for non-auth API errors instead of normalizing them as success", async () => {
    const ensureHelpdeskSession = vi.fn().mockResolvedValue(undefined);
    const executeTicketFetch = vi.fn().mockResolvedValue({
      httpStatus: 500,
      json: {
        response_status: [{ status_code: 5000, status: "failed" }],
        message: "server exploded",
      },
    });
    const loginAndSaveState = vi.fn();

    const result = await fetchTickets(
      { count: 1, stateFile: "/tmp/state.json" },
      { ensureHelpdeskSession, executeTicketFetch, loginAndSaveState },
    );

    expect(result).toEqual({
      ok: false,
      source: "live",
      error: "Helpdesk API request failed with HTTP 500.",
      details: {
        response_status: [{ status_code: 5000, status: "failed" }],
        message: "server exploded",
      },
    });
    expect(loginAndSaveState).not.toHaveBeenCalled();
  });

  it("returns a failure when a 200 payload is missing the requests array", async () => {
    const ensureHelpdeskSession = vi.fn().mockResolvedValue(undefined);
    const executeTicketFetch = vi.fn().mockResolvedValue({
      httpStatus: 200,
      json: {
        response_status: [{ status_code: 2000, status: "success" }],
      },
    });
    const loginAndSaveState = vi.fn();

    const result = await fetchTickets(
      { count: 1, stateFile: "/tmp/state.json" },
      { ensureHelpdeskSession, executeTicketFetch, loginAndSaveState },
    );

    expect(result).toEqual({
      ok: false,
      source: "live",
      error: "Helpdesk API response is missing the requests array.",
    });
    expect(loginAndSaveState).not.toHaveBeenCalled();
  });
});

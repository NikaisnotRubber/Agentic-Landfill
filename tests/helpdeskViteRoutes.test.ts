import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TicketFetchResult, TicketFetchSuccess } from "../server/types";

const fetchAndEnrichTicketsMock = vi.hoisted(() => vi.fn());
const readBodyMock = vi.hoisted(() => vi.fn());

vi.mock("../server/fetchAndEnrichTickets", () => ({
  fetchAndEnrichTickets: fetchAndEnrichTicketsMock,
}));

vi.mock("../server/http", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../server/http")>();
  return {
    ...actual,
    readBody: readBodyMock,
  };
});

import { registerHelpdeskTicketRoutes } from "../server/helpdeskVitePlugin";

function createFetchedSuccess(
  overrides: Partial<TicketFetchSuccess> = {},
): TicketFetchSuccess {
  return {
    ok: true,
    source: "live",
    count: 1,
    tickets: [
      {
        id: "817742",
        subject: "DDP software install",
        requester: "JIAHUA.WU 吳家驊",
        technician: "ALVIS.MC.TSAO 曹閔丞",
        created_time: "2026-05-29T10:00:00Z",
        site: "TPE",
        category: "Software",
        status: "Open",
        group: "IT",
        short_description: "Install DDP",
      },
    ],
    ...overrides,
  };
}

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

function loadFetchAndEnrichHandler(options: {
  fetchAndEnrichResult?: TicketFetchResult;
  readBodyValue?: string;
} = {}) {
  fetchAndEnrichTicketsMock.mockResolvedValue(
    options.fetchAndEnrichResult ?? createFetchedSuccess(),
  );
  readBodyMock.mockResolvedValue(
    options.readBodyValue ?? JSON.stringify({ count: 25 }),
  );

  const middlewares = { use: vi.fn() };
  registerHelpdeskTicketRoutes(middlewares);

  const registration = middlewares.use.mock.calls.find(([path]) => (
    path === "/api/tickets/fetch-and-enrich"
  ));

  expect(registration).toBeDefined();
  return registration![1] as (
    request: { method?: string },
    response: ReturnType<typeof createMockResponse>,
  ) => Promise<void>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("helpdesk vite fetch-and-enrich route", () => {
  it("registers a POST /api/tickets/fetch-and-enrich handler", async () => {
    const handler = loadFetchAndEnrichHandler();
    const response = createMockResponse();

    await handler({ method: "GET" }, response);

    expect(response.statusCode).toBe(405);
    expect(JSON.parse(response.body)).toMatchObject({
      ok: false,
      error: "Method not allowed",
    });
  });

  it("returns a 200 response for POST partial-success results", async () => {
    const partialSuccess = createFetchedSuccess({
      adWarning: "LDAP unavailable",
    });
    const handler = loadFetchAndEnrichHandler({
      fetchAndEnrichResult: partialSuccess,
      readBodyValue: JSON.stringify({
        count: 10,
        technician: "ALVIS.MC.TSAO 曹閔丞",
        filterId: "2130",
        stateFile: "/tmp/state.json",
      }),
    });
    const response = createMockResponse();

    await handler({ method: "POST" }, response);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(partialSuccess);
    expect(fetchAndEnrichTicketsMock).toHaveBeenCalledWith({
      count: 10,
      technician: "ALVIS.MC.TSAO 曹閔丞",
      filterId: "2130",
      stateFile: "/tmp/state.json",
    });
  });

  it("returns a 401 response only for auth-shaped failures", async () => {
    const authFailure = {
      ok: false as const,
      source: "live" as const,
      error: "Helpdesk session refresh succeeded but API still reports unauthorized access.",
      details: {
        response_status: {
          status_code: 4000,
          status: "failed",
          messages: [{ status_code: 401, message: "AuthToken invalid" }],
        },
      },
    };
    const handler = loadFetchAndEnrichHandler({
      fetchAndEnrichResult: authFailure,
    });
    const response = createMockResponse();

    await handler({ method: "POST" }, response);

    expect(response.statusCode).toBe(401);
    expect(JSON.parse(response.body)).toEqual(authFailure);
  });

  it("returns a 500 response for non-auth failures from the combined flow", async () => {
    const fetchFailure = {
      ok: false as const,
      source: "live" as const,
      error: "Helpdesk API request failed with HTTP 500.",
      details: {
        message: "Internal Server Error",
      },
    };
    const handler = loadFetchAndEnrichHandler({
      fetchAndEnrichResult: fetchFailure,
    });
    const response = createMockResponse();

    await handler({ method: "POST" }, response);

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body)).toEqual(fetchFailure);
  });
});

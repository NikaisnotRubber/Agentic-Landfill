import { describe, expect, it, vi } from "vitest";

import { fetchAndEnrichTickets } from "../server/fetchAndEnrichTickets";
import type { TicketFetchResult, TicketFetchSuccess } from "../server/types";

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

describe("fetchAndEnrichTickets", () => {
  it("returns fetch failures without attempting AD enrichment", async () => {
    const fetchFailure = {
      ok: false as const,
      source: "live" as const,
      error: "Helpdesk fetch failed",
    };
    const createLookupClient = vi.fn();

    const result = await fetchAndEnrichTickets(
      { count: 25 },
      {
        fetchTickets: vi.fn().mockResolvedValue(fetchFailure),
        enrichTicketsWithAd: vi.fn(),
        createLookupClient,
      },
    );

    expect(result).toBe(fetchFailure);
    expect(createLookupClient).not.toHaveBeenCalled();
  });

  it("returns processed metadata without AD lookup when no tickets are returned", async () => {
    const fetched = createFetchedSuccess({ count: 0, tickets: [] });
    const createLookupClient = vi.fn();

    const result = await fetchAndEnrichTickets(
      { count: 25 },
      {
        fetchTickets: vi.fn().mockResolvedValue(fetched),
        enrichTicketsWithAd: vi.fn(),
        createLookupClient,
      },
    );

    expect(result).toEqual({
      ...fetched,
      processedRows: [],
      processedSummary: {
        totalRows: 0,
        abnormalRowCount: 0,
        newTicketCount: 0,
      },
    });
    expect(createLookupClient).not.toHaveBeenCalled();
  });

  it("returns enriched tickets and AD summary when enrichment succeeds", async () => {
    const fetched = createFetchedSuccess();
    const close = vi.fn().mockResolvedValue(undefined);
    const lookupClient = { lookupUser: vi.fn(), close };
    const enrichTicketsWithAd = vi.fn().mockResolvedValue({
      tickets: [
        {
          ...fetched.tickets[0],
          ad: {
            status: "enriched" as const,
            adAccount: "JIAHUA.WU",
            displayName: "吳家驊",
            mail: "jiahua.wu@example.com",
            department: "IT",
            manager: "王小明",
            managerAccount: "",
            employeeId: "12345",
            bg: "LTW",
            bu: "IT",
          },
        },
      ],
      summary: {
        totalTickets: 1,
        uniqueAccounts: 1,
        enrichedCount: 1,
        missingRequesterCount: 0,
        notFoundCount: 0,
        lookupFailedCount: 0,
      },
    });

    const result = await fetchAndEnrichTickets(
      { count: 25 },
      {
        fetchTickets: vi.fn().mockResolvedValue(fetched),
        enrichTicketsWithAd,
        createLookupClient: vi.fn().mockReturnValue(lookupClient),
      },
    );

    expect(result).toMatchObject({
      ok: true,
      count: 1,
      adSummary: {
        enrichedCount: 1,
      },
      tickets: [
        {
          id: "817742",
          ad: {
            status: "enriched",
            manager: "王小明",
          },
        },
      ],
    });
    expect(enrichTicketsWithAd).toHaveBeenCalledWith(fetched.tickets, lookupClient);
    expect(close).toHaveBeenCalledTimes(1);
    if (result.ok) {
      expect(result.processedRows?.[0]?.adAccount).toBe("JIAHUA.WU");
      expect(result.processedRows?.[0]?.adName).toBe("吳家驊");
      expect(result.processedRows?.[0]?.abnormalFlags).not.toContain("missing-ad-account");
    }
  });

  it("returns the fetched success with an AD warning when enrichment fails", async () => {
    const fetched = createFetchedSuccess();
    const close = vi.fn().mockResolvedValue(undefined);

    const result = await fetchAndEnrichTickets(
      { count: 25 },
      {
        fetchTickets: vi.fn().mockResolvedValue(fetched),
        enrichTicketsWithAd: vi.fn().mockRejectedValue(new Error("LDAP unavailable")),
        createLookupClient: vi.fn().mockReturnValue({
          lookupUser: vi.fn(),
          close,
        }),
      },
    );

    expect(result).toMatchObject({
      ok: true,
      count: 1,
      tickets: fetched.tickets,
      adWarning: "LDAP unavailable",
    });
    expect(result).not.toHaveProperty("adSummary");
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("preserves a partial-success result when lookup client close fails", async () => {
    const fetched = createFetchedSuccess();

    const result = await fetchAndEnrichTickets(
      { count: 25 },
      {
        fetchTickets: vi.fn().mockResolvedValue(fetched),
        enrichTicketsWithAd: vi.fn().mockRejectedValue(new Error("LDAP unavailable")),
        createLookupClient: vi.fn().mockReturnValue({
          lookupUser: vi.fn(),
          close: vi.fn().mockRejectedValue(new Error("unbind failed")),
        }),
      },
    );

    expect(result).toMatchObject({
      ok: true,
      tickets: fetched.tickets,
      adWarning: "LDAP unavailable",
    });
  });
});

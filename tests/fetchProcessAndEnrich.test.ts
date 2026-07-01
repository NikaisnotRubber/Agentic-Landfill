import { rm } from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { attachProcessedPayload, fetchProcessAndEnrich } from "../server/fetchProcessAndEnrich";
import type { ProcessedDdpRow } from "../server/ddp/types";

const originalDatabaseUrl = process.env.DATABASE_URL;
const originalPlatformSyncTickets = process.env.PLATFORM_SYNC_TICKETS;
const DB_PATH = path.resolve("tests/fixtures/fetch-process-sync-test.db");

function restoreEnv(name: "DATABASE_URL" | "PLATFORM_SYNC_TICKETS", value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

function sampleProcessedRow(overrides: Partial<ProcessedDdpRow> = {}): ProcessedDdpRow {
  return {
    ticketId: "822230",
    status: "Open",
    subject: "DDP A",
    requester: "A.USER",
    isNewTicket: true,
    adAccount: "A.USER",
    adName: "A User",
    firstName: "A",
    lastName: "User",
    mail: "a.user@deltaww.com",
    bu: "IT",
    nbHostname: "TWCL1NB1234",
    vmHostname: "TWPJRDPSCNLT05",
    role: "",
    application: "Digital Design Platform",
    userRoles: "MGR_ROLE_A",
    abnormalFlags: [],
    ...overrides,
  };
}

afterEach(async () => {
  restoreEnv("DATABASE_URL", originalDatabaseUrl);
  restoreEnv("PLATFORM_SYNC_TICKETS", originalPlatformSyncTickets);
  await rm(DB_PATH, { force: true });
});

describe("fetchProcessAndEnrich", () => {
  it("returns processed rows and tracker summary for successful fetches", async () => {
    process.env.PLATFORM_SYNC_TICKETS = "0";

    const result = await fetchProcessAndEnrich(
      { count: 5 },
      { persistTracker: true },
      {
        fetchTickets: vi.fn().mockResolvedValue({
          ok: true,
          source: "live",
          count: 1,
          tickets: [
            {
              id: "822230",
              subject: "DDP A",
              requester: "A.USER 測試員",
              technician: "",
              created_time: "",
              site: "",
              category: "",
              status: "Open",
              group: "",
              short_description: "電腦編號(NB): TWCL1NB1234",
            },
          ],
        }),
        detectNewTickets: vi.fn().mockResolvedValue({
          newTicketIds: ["822230"],
          summary: {
            latestSeenId: "822230",
            previousSeenId: undefined,
            newTicketCount: 1,
          },
        }),
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.processedRows).toHaveLength(1);
    expect(result.processedSummary?.newTicketCount).toBe(1);
    expect(result.processedRows?.[0]?.isNewTicket).toBe(true);
    expect(result.processedSummary?.mappingSync).toBeUndefined();
  });

  it("attaches mapping sync summary when ticket sync is enabled", async () => {
    process.env.DATABASE_URL = `file:${DB_PATH}`;
    delete process.env.PLATFORM_SYNC_TICKETS;

    const result = await attachProcessedPayload(
      {
        ok: true,
        source: "live",
        count: 1,
        tickets: [
          {
            id: "822230",
            subject: "DDP A",
            requester: "A.USER",
            technician: "",
            created_time: "",
            site: "",
            category: "",
            status: "Open",
            group: "",
            short_description: "",
          },
        ],
      },
      { persistTracker: false },
      {
        processDdpTickets: vi.fn().mockReturnValue({
          rows: [sampleProcessedRow()],
          summary: {
            totalRows: 1,
            abnormalRowCount: 0,
            newTicketCount: 0,
          },
        }),
      },
    );

    expect(result.processedSummary?.mappingSync).toEqual({
      attempted: 1,
      upserted: 1,
      skipped: 0,
    });
  });

  it("omits mapping sync summary when ticket sync is disabled", async () => {
    process.env.PLATFORM_SYNC_TICKETS = "0";

    const result = await attachProcessedPayload(
      {
        ok: true,
        source: "live",
        count: 1,
        tickets: [
          {
            id: "822231",
            subject: "DDP B",
            requester: "B.USER",
            technician: "",
            created_time: "",
            site: "",
            category: "",
            status: "Open",
            group: "",
            short_description: "",
          },
        ],
      },
      { persistTracker: false },
      {
        processDdpTickets: vi.fn().mockReturnValue({
          rows: [sampleProcessedRow({ ticketId: "822231", adAccount: "B.USER" })],
          summary: {
            totalRows: 1,
            abnormalRowCount: 0,
            newTicketCount: 0,
          },
        }),
      },
    );

    expect(result.processedRows).toHaveLength(1);
    expect(result.processedSummary?.mappingSync).toBeUndefined();
  });
});

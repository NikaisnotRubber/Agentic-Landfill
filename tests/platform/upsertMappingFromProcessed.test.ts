import path from "node:path";
import { describe, expect, it, afterEach } from "vitest";

import { openMigratedPlatformDatabase } from "../../platform/db/database";
import { LIVE_TICKET_BATCH_ID } from "../../platform/sync/constants";
import { upsertMappingFromProcessedRows } from "../../platform/sync/upsertMappingFromProcessed";
import type { ProcessedDdpRow } from "../../server/ddp/types";

const DB_PATH = path.resolve("tests/fixtures/platform-batch/ticket-upsert-test.db");

function sampleRow(overrides: Partial<ProcessedDdpRow> = {}): ProcessedDdpRow {
  return {
    ticketId: "822184",
    status: "Open",
    subject: "[DDP] test",
    requester: "LEO.ZOU",
    isNewTicket: true,
    adAccount: "LEO.ZOU",
    adName: "鄒皓年",
    firstName: "LEO",
    lastName: "ZOU",
    mail: "LEO.ZOU@DELTAWW.COM",
    bu: "BU1",
    nbHostname: "TWCL1NB5308",
    vmHostname: "TWPJRDPSCNLT05",
    role: "",
    application: "Digital Design Platform",
    userRoles: "MGR_ROLE_A",
    abnormalFlags: [],
    ...overrides,
  };
}

describe("upsertMappingFromProcessedRows", () => {
  afterEach(() => {
    delete process.env.DATABASE_URL;
  });

  it("inserts and updates ticket mapping rows on the same upsert key", () => {
    process.env.DATABASE_URL = `file:${DB_PATH}`;
    const db = openMigratedPlatformDatabase(DB_PATH);

    const first = upsertMappingFromProcessedRows(db, [sampleRow({ bu: "BU-A" })]);
    expect(first.upserted).toBe(1);

    const second = upsertMappingFromProcessedRows(db, [
      sampleRow({ ticketId: "822999", bu: "BU-B" }),
    ]);
    expect(second.upserted).toBe(1);

    const rows = db
      .prepare(
        `SELECT ad_account, bu, ticket_id, source_kind, batch_id
         FROM mapping_row WHERE ad_account = ? AND source_kind = 'ticket'`,
      )
      .all("LEO.ZOU") as {
      ad_account: string;
      bu: string;
      ticket_id: string;
      source_kind: string;
      batch_id: string;
    }[];

    expect(rows).toHaveLength(1);
    expect(rows[0]?.bu).toBe("BU-B");
    expect(rows[0]?.ticket_id).toBe("822999");
    expect(rows[0]?.batch_id).toBe(LIVE_TICKET_BATCH_ID);

    db.close();
  });

  it("skips rows without ad account", () => {
    process.env.DATABASE_URL = `file:${DB_PATH}-skip.db`;
    const db = openMigratedPlatformDatabase(process.env.DATABASE_URL.slice("file:".length));

    const summary = upsertMappingFromProcessedRows(db, [sampleRow({ adAccount: "" })]);
    expect(summary.skipped).toBe(1);
    expect(summary.upserted).toBe(0);

    db.close();
  });
});

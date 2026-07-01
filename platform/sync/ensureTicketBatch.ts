import type { PlatformDatabase } from "../db/database";
import { LIVE_TICKET_BATCH_ID } from "./constants";

export function ensureLiveTicketBatch(db: PlatformDatabase): void {
  const existing = db
    .prepare(`SELECT id FROM batches WHERE id = ?`)
    .get(LIVE_TICKET_BATCH_ID) as { id: string } | undefined;

  if (existing) {
    db.prepare(
      `UPDATE batches SET status = 'published', published_at = COALESCE(published_at, datetime('now')) WHERE id = ?`,
    ).run(LIVE_TICKET_BATCH_ID);
    return;
  }

  db.prepare(
    `INSERT INTO batches (id, status, published_at) VALUES (?, 'published', datetime('now'))`,
  ).run(LIVE_TICKET_BATCH_ID);
}

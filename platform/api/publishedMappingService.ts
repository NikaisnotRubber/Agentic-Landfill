import { loadMappingExportSchema } from "../contract/loadMappingExportSchema";
import type { PlatformDatabase } from "../db/database";
import { getPublishedBatchId } from "../batch/batchService";
import { serializeMappingRowRecord } from "../export/serializeMappingRow";
import type { MappingRow } from "../export/types";
import { LIVE_TICKET_BATCH_ID } from "../sync/constants";
import { shouldSyncTicketsToMappingDb } from "../sync/upsertMappingFromProcessed";

export type PublishedBatchMetadata = {
  batchId: string;
  status: string;
  rowCount: number;
  publishedAt: string | null;
  ruleVersion: string;
};

export type MappingRowQueryResult = {
  batchId: string;
  total: number;
  limit: number;
  offset: number;
  rows: Record<string, string>[];
};

export type MappingSyncStatus = {
  batchId: string;
  rowCount: number;
  lastUpdatedAt: string | null;
  platformSyncTicketsEnabled: boolean;
};

export function getPublishedBatchMetadata(db: PlatformDatabase): PublishedBatchMetadata | null {
  const batchId = getPublishedBatchId(db);
  if (!batchId) {
    return null;
  }

  const batch = db
    .prepare(
      `SELECT id, status, published_at, rule_version FROM batches WHERE id = ?`,
    )
    .get(batchId) as
    | { id: string; status: string; published_at: string | null; rule_version: string }
    | undefined;

  if (!batch) {
    return null;
  }

  const countRow = db
    .prepare(`SELECT COUNT(*) AS count FROM mapping_row WHERE batch_id = ?`)
    .get(batchId) as { count: number };

  return {
    batchId: batch.id,
    status: batch.status,
    rowCount: countRow.count,
    publishedAt: batch.published_at,
    ruleVersion: batch.rule_version,
  };
}

export function listMappingBatches(
  db: PlatformDatabase,
  limit = 20,
): Array<{ batchId: string; status: string; publishedAt: string | null; rowCount: number }> {
  const batches = db
    .prepare(
      `
      SELECT b.id, b.status, b.published_at,
        (SELECT COUNT(*) FROM mapping_row m WHERE m.batch_id = b.id) AS row_count
      FROM batches b
      ORDER BY COALESCE(b.published_at, b.created_at) DESC
      LIMIT ?
    `,
    )
    .all(limit) as Array<{
      id: string;
      status: string;
      published_at: string | null;
      row_count: number;
    }>;

  return batches.map((batch) => ({
    batchId: batch.id,
    status: batch.status,
    publishedAt: batch.published_at,
    rowCount: batch.row_count,
  }));
}

export function getLiveTicketSyncStatus(db: PlatformDatabase): MappingSyncStatus {
  const row = db
    .prepare(
      `
      SELECT COUNT(*) AS row_count, MAX(updated_at) AS last_updated_at
      FROM mapping_row
      WHERE batch_id = ? AND source_kind = 'ticket'
    `,
    )
    .get(LIVE_TICKET_BATCH_ID) as { row_count: number; last_updated_at: string | null };

  return {
    batchId: LIVE_TICKET_BATCH_ID,
    rowCount: row.row_count,
    lastUpdatedAt: row.last_updated_at,
    platformSyncTicketsEnabled: shouldSyncTicketsToMappingDb(),
  };
}

export async function queryPublishedMappingRows(
  db: PlatformDatabase,
  options: { adAccount?: string; limit?: number; offset?: number },
): Promise<MappingRowQueryResult | null> {
  const batchId = getPublishedBatchId(db);
  if (!batchId) {
    return null;
  }

  const schema = await loadMappingExportSchema();
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 500);
  const offset = Math.max(options.offset ?? 0, 0);
  const adAccount = options.adAccount?.trim().toUpperCase();

  let total: number;
  let rows: MappingRow[];

  if (adAccount) {
    total = (
      db
        .prepare(`SELECT COUNT(*) AS count FROM mapping_row WHERE batch_id = ? AND ad_account = ?`)
        .get(batchId, adAccount) as { count: number }
    ).count;
    rows = db
      .prepare(
        `
        SELECT * FROM mapping_row
        WHERE batch_id = ? AND ad_account = ?
        ORDER BY group_name, vm_hostname
        LIMIT ? OFFSET ?
      `,
      )
      .all(batchId, adAccount, limit, offset) as MappingRow[];
  } else {
    total = (
      db.prepare(`SELECT COUNT(*) AS count FROM mapping_row WHERE batch_id = ?`).get(batchId) as {
        count: number;
      }
    ).count;
    rows = db
      .prepare(
        `
        SELECT * FROM mapping_row
        WHERE batch_id = ?
        ORDER BY bg, ad_account, group_name, vm_hostname
        LIMIT ? OFFSET ?
      `,
      )
      .all(batchId, limit, offset) as MappingRow[];
  }

  return {
    batchId,
    total,
    limit,
    offset,
    rows: rows.map((row) => serializeMappingRowRecord(row, schema)),
  };
}

import { randomUUID } from "node:crypto";

import type { PlatformDatabase } from "../db/database";
import type { BatchFileSet } from "../import/importBatchFiles";
import { importBatchFiles } from "../import/importBatchFiles";
import { materializeMappingRows } from "../mapping/materializeMappingRows";

export function createBatch(db: PlatformDatabase): string {
  const id = randomUUID();
  db.prepare(`INSERT INTO batches (id, status) VALUES (?, 'draft')`).run(id);
  return id;
}

export async function runBatchImportAndMap(
  db: PlatformDatabase,
  batchId: string,
  files: BatchFileSet,
): Promise<{ importCounts: Awaited<ReturnType<typeof importBatchFiles>>; mappingRows: number }> {
  const importCounts = await importBatchFiles(db, batchId, files);
  db.prepare(`UPDATE batches SET status = 'mapping' WHERE id = ?`).run(batchId);
  const mappingRows = materializeMappingRows(db, batchId);
  return { importCounts, mappingRows };
}

export function getPublishedBatchId(db: PlatformDatabase): string | null {
  const row = db
    .prepare(`SELECT id FROM batches WHERE status = 'published' ORDER BY published_at DESC LIMIT 1`)
    .get() as { id: string } | undefined;
  return row?.id ?? null;
}

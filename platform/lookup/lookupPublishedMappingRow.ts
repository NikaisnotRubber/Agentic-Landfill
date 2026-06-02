import { getPublishedBatchId } from "../batch/batchService";
import type { PlatformDatabase } from "../db/database";
import { resolveRoleExportValue } from "../export/serializeMappingRow";
import type { MappingRow } from "../export/types";

export type PublishedMappingLookup = {
  role: string;
  application: string;
  userRoles: string;
  vmHostname: string;
  hostIp: string;
};

export function lookupPublishedMappingRow(
  db: PlatformDatabase,
  adAccount: string,
  vmHostname = "",
): PublishedMappingLookup | null {
  const batchId = getPublishedBatchId(db);
  if (!batchId) {
    return null;
  }

  const account = adAccount.trim().toUpperCase();
  const host = vmHostname.trim().toUpperCase();

  let row: MappingRow | undefined;

  if (host) {
    row = db
      .prepare(
        `
        SELECT * FROM mapping_row
        WHERE batch_id = ? AND ad_account = ? AND vm_hostname = ?
        LIMIT 1
      `,
      )
      .get(batchId, account, host) as MappingRow | undefined;
  }

  if (!row) {
    row = db
      .prepare(
        `
        SELECT * FROM mapping_row
        WHERE batch_id = ? AND ad_account = ?
        ORDER BY vm_hostname
        LIMIT 1
      `,
      )
      .get(batchId, account) as MappingRow | undefined;
  }

  if (!row) {
    return null;
  }

  return {
    role: resolveRoleExportValue(row),
    application: row.application ?? "",
    userRoles: row.user_roles ?? "",
    vmHostname: row.vm_hostname ?? "",
    hostIp: row.host_ip ?? "",
  };
}

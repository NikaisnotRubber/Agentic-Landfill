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

type MappingSourceKind = "ticket" | "batch";

function findPublishedMappingRow(
  db: PlatformDatabase,
  options: {
    adAccount: string;
    vmHostname?: string;
    sourceKind: MappingSourceKind;
  },
): MappingRow | undefined {
  const account = options.adAccount.trim().toUpperCase();
  const host = options.vmHostname?.trim().toUpperCase() ?? "";

  const base = `
    SELECT m.* FROM mapping_row m
    INNER JOIN batches b ON b.id = m.batch_id AND b.status = 'published'
    WHERE m.ad_account = ? AND m.source_kind = ?
  `;

  if (host) {
    return db
      .prepare(`${base} AND m.vm_hostname = ? ORDER BY m.vm_hostname LIMIT 1`)
      .get(account, options.sourceKind, host) as MappingRow | undefined;
  }

  return db
    .prepare(`${base} ORDER BY m.vm_hostname LIMIT 1`)
    .get(account, options.sourceKind) as MappingRow | undefined;
}

function toPublishedLookup(row: MappingRow): PublishedMappingLookup {
  return {
    role: resolveRoleExportValue(row),
    application: row.application ?? "",
    userRoles: row.user_roles ?? "",
    vmHostname: row.vm_hostname ?? "",
    hostIp: row.host_ip ?? "",
  };
}

export function lookupPublishedMappingRow(
  db: PlatformDatabase,
  adAccount: string,
  vmHostname = "",
): PublishedMappingLookup | null {
  const account = adAccount.trim().toUpperCase();
  const host = vmHostname.trim().toUpperCase();
  const kinds: MappingSourceKind[] = ["ticket", "batch"];

  if (host) {
    for (const sourceKind of kinds) {
      const row = findPublishedMappingRow(db, { adAccount: account, vmHostname: host, sourceKind });
      if (row) {
        return toPublishedLookup(row);
      }
    }
  }

  for (const sourceKind of kinds) {
    const row = findPublishedMappingRow(db, { adAccount: account, sourceKind });
    if (row) {
      return toPublishedLookup(row);
    }
  }

  return null;
}

type LdapSearchFn = (filter: string) => Promise<Record<string, unknown> | null>;

function readString(entry: Record<string, unknown>, key: string): string {
  const value = entry[key];
  return typeof value === "string" ? value : "";
}

function escapeLdapFilterValue(value: string): string {
  return value
    .replaceAll("\\", "\\5c")
    .replaceAll("*", "\\2a")
    .replaceAll("(", "\\28")
    .replaceAll(")", "\\29")
    .replaceAll("\u0000", "\\00");
}

export function managerDnFilter(managerDn: string): string {
  return `(distinguishedName=${escapeLdapFilterValue(managerDn)})`;
}

export async function enrichEntryWithManagerAccount(
  searchByFilter: LdapSearchFn,
  entry: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const managerDn = readString(entry, "manager");
  if (!managerDn.includes("CN=")) {
    return entry;
  }

  const managerEntry = await searchByFilter(managerDnFilter(managerDn));
  if (!managerEntry) {
    return entry;
  }

  const managerSamAccountName = readString(managerEntry, "sAMAccountName");
  if (!managerSamAccountName) {
    return entry;
  }

  return {
    ...entry,
    managerSamAccountName,
  };
}

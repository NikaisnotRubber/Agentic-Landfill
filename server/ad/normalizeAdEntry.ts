export type NormalizedAdEntry = {
  adAccount: string;
  displayName: string;
  mail: string;
  department: string;
  manager: string;
  employeeId: string;
  bg: string;
  bu: string;
};

function readString(entry: Record<string, unknown>, key: string): string {
  const value = entry[key];
  return typeof value === "string" ? value : "";
}

function extractCn(distinguishedName: string): string {
  const match = /CN=([^,]+)/i.exec(distinguishedName);
  return match?.[1] ?? distinguishedName;
}

function trimSlashValue(value: string): string {
  if (!value) {
    return "";
  }

  return value.includes("/") ? value.split("/")[0] : value;
}

export function normalizeAdEntry(entry: Record<string, unknown>): NormalizedAdEntry {
  const managerValue = readString(entry, "manager");

  return {
    adAccount: readString(entry, "sAMAccountName"),
    displayName: readString(entry, "cn"),
    mail: readString(entry, "mail"),
    department: readString(entry, "department"),
    manager: managerValue.includes("CN=") ? extractCn(managerValue) : managerValue,
    employeeId: readString(entry, "extensionAttribute15"),
    bg: trimSlashValue(readString(entry, "extensionAttribute1")),
    bu: trimSlashValue(readString(entry, "extensionAttribute2")),
  };
}

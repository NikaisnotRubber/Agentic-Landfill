import { looksLikeSamAccountName } from "./requesterParser";
import { repairMojibakeText } from "./repairMojibakeText";

export type NormalizedAdEntry = {
  adAccount: string;
  displayName: string;
  mail: string;
  department: string;
  manager: string;
  managerAccount: string;
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
  const managerSamAccountName = readString(entry, "managerSamAccountName");
  const managerAccount =
    managerSamAccountName
    || (looksLikeSamAccountName(managerValue) ? managerValue.trim() : "");

  const displayName = repairMojibakeText(readString(entry, "cn"));
  const managerDisplay = managerValue.includes("CN=")
    ? repairMojibakeText(extractCn(managerValue))
    : repairMojibakeText(managerValue);

  return {
    adAccount: readString(entry, "sAMAccountName"),
    displayName,
    mail: readString(entry, "mail"),
    department: readString(entry, "department"),
    manager: managerDisplay,
    managerAccount,
    employeeId: readString(entry, "extensionAttribute15"),
    bg: trimSlashValue(readString(entry, "extensionAttribute1")),
    bu: trimSlashValue(readString(entry, "extensionAttribute2")),
  };
}

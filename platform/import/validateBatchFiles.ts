import { access } from "node:fs/promises";
import { readFile } from "node:fs/promises";

import { parseCsvRecords } from "../io/csv";
import type { BatchFileSet } from "./importBatchFiles";

export type BatchFileValidationResult = { ok: true } | { ok: false; error: string };

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function assertCsvHeaders(
  records: Record<string, string>[],
  required: string[],
  label: string,
): BatchFileValidationResult {
  if (records.length === 0) {
    return { ok: false, error: `${label}: file has no data rows` };
  }

  const headers = Object.keys(records[0]);
  for (const key of required) {
    if (!headers.includes(key)) {
      return { ok: false, error: `${label}: missing required column "${key}"` };
    }
  }

  return { ok: true };
}

export async function validateBatchFiles(files: BatchFileSet): Promise<BatchFileValidationResult> {
  const requiredPaths: { path: string; label: string }[] = [
    { path: files.adGroupsXlsx, label: "AD groups xlsx" },
    { path: files.userRolesCsv, label: "User_Roles csv" },
    { path: files.usersCsv, label: "Users csv" },
    { path: files.serverProfilesCsv, label: "Server_Profiles csv" },
  ];

  for (const entry of requiredPaths) {
    if (!(await fileExists(entry.path))) {
      return { ok: false, error: `${entry.label} not found: ${entry.path}` };
    }
  }

  const roles = parseCsvRecords(await readFile(files.userRolesCsv, "utf8"));
  const rolesCheck = assertCsvHeaders(roles, ["Role"], "User_Roles csv");
  if (!rolesCheck.ok) {
    return rolesCheck;
  }

  const users = parseCsvRecords(await readFile(files.usersCsv, "utf8"));
  const usersCheck = assertCsvHeaders(users, ["Account"], "Users csv");
  if (!usersCheck.ok) {
    return usersCheck;
  }

  const servers = parseCsvRecords(await readFile(files.serverProfilesCsv, "utf8"));
  const serversCheck = assertCsvHeaders(
    servers,
    ["Hostname", "Application(Server Group)"],
    "Server_Profiles csv",
  );
  if (!serversCheck.ok) {
    return serversCheck;
  }

  return { ok: true };
}

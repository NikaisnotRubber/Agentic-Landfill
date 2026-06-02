import { parseCsvRecords } from "./parseCsv";
import type { ZenteraIndexes } from "./types";

function normalizeAccount(value: string): string {
  return value.trim().toUpperCase();
}

function splitUsersField(usersValue: string): string[] {
  return usersValue
    .split(",")
    .map((user) => normalizeAccount(user))
    .filter(Boolean);
}

export function buildZenteraIndexesFromCsv(options: {
  userRolesCsv: string;
  serverProfilesCsv: string;
}): ZenteraIndexes {
  const rolesByUser = new Map<string, Set<string>>();
  const hostnamesByRole = new Map<string, string[]>();

  for (const record of parseCsvRecords(options.userRolesCsv)) {
    const role = (record.Role ?? "").trim();
    if (!role) {
      continue;
    }

    const usersValue = record.User ?? record.Users ?? "";
    for (const user of splitUsersField(usersValue)) {
      const roles = rolesByUser.get(user) ?? new Set<string>();
      roles.add(role);
      rolesByUser.set(user, roles);
    }
  }

  const hostnamesByRoleSets = new Map<string, Set<string>>();
  const roleByHostname = new Map<string, string>();
  const appProfileByHostname = new Map<string, string>();

  for (const record of parseCsvRecords(options.serverProfilesCsv)) {
    const role = (record["Application(Server Group)"] ?? "").trim();
    const hostname = (record.Hostname ?? "").trim();
    if (!role || !hostname) {
      continue;
    }

    const hostKey = hostname.toUpperCase();
    const bucket = hostnamesByRoleSets.get(role) ?? new Set<string>();
    bucket.add(hostname);
    hostnamesByRoleSets.set(role, bucket);

    if (!roleByHostname.has(hostKey)) {
      roleByHostname.set(hostKey, role);
    }

    const appProfile = (record["App Profile"] ?? "").trim();
    if (appProfile && !appProfileByHostname.has(hostKey)) {
      appProfileByHostname.set(hostKey, appProfile);
    }
  }

  for (const [role, hostnames] of hostnamesByRoleSets) {
    hostnamesByRole.set(role, [...hostnames].sort((left, right) => left.localeCompare(right)));
  }

  return { rolesByUser, hostnamesByRole, roleByHostname, appProfileByHostname };
}

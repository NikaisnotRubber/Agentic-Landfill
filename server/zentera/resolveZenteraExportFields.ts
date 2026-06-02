import { deriveRoleCodeFromVmHostname } from "./deriveRoleFromVmHostname";
import type { ZenteraExportFields, ZenteraIndexes } from "./types";

function normalizeAccount(value: string): string {
  return value.trim().toUpperCase();
}

function normalizeHostname(value: string): string {
  return value.trim().toUpperCase();
}

function listRolesForAccount(account: string, indexes: ZenteraIndexes): string[] {
  const roles = indexes.rolesByUser.get(normalizeAccount(account));
  if (!roles || roles.size === 0) {
    return [];
  }
  return [...roles].sort((left, right) => left.localeCompare(right));
}

function listRolesForHostname(hostname: string, indexes: ZenteraIndexes): string[] {
  const hostKey = normalizeHostname(hostname);
  const roles: string[] = [];

  for (const [role, hostnames] of indexes.hostnamesByRole) {
    if (hostnames.some((entry) => normalizeHostname(entry) === hostKey)) {
      roles.push(role);
    }
  }

  return roles.sort((left, right) => left.localeCompare(right));
}

function resolveRoleName(
  vmHostname: string,
  indexes: ZenteraIndexes | null,
): string {
  if (!vmHostname) {
    return "";
  }

  if (indexes) {
    const hostKey = normalizeHostname(vmHostname);
    const mapped = indexes.roleByHostname.get(hostKey);
    if (mapped) {
      return mapped;
    }

    const roles = listRolesForHostname(vmHostname, indexes);
    if (roles.length > 0) {
      return roles[0] ?? "";
    }
  }

  return deriveRoleCodeFromVmHostname(vmHostname);
}

function resolveApplication(vmHostname: string, indexes: ZenteraIndexes | null): string {
  if (!vmHostname || !indexes) {
    return "";
  }

  return indexes.appProfileByHostname.get(normalizeHostname(vmHostname)) ?? "";
}

function resolveUserRoles(
  managerAccount: string,
  applicantAccount: string,
  indexes: ZenteraIndexes | null,
): string {
  if (!indexes) {
    return "";
  }

  const managerRoles = listRolesForAccount(managerAccount, indexes);
  if (managerRoles.length > 0) {
    return managerRoles.join(", ");
  }

  const applicantRoles = listRolesForAccount(applicantAccount, indexes);
  return applicantRoles.join(", ");
}

export function resolveZenteraExportFields(options: {
  vmHostname: string;
  managerAccount: string;
  applicantAccount: string;
  zentera: ZenteraIndexes | null;
}): ZenteraExportFields {
  const role = resolveRoleName(options.vmHostname, options.zentera);

  return {
    role,
    application: resolveApplication(options.vmHostname, options.zentera),
    userRoles: resolveUserRoles(
      options.managerAccount,
      options.applicantAccount,
      options.zentera,
    ),
  };
}

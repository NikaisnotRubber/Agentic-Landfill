import type { ZenteraIndexes, VmHostnameLookupResult } from "./types";

function normalizeAccount(value: string | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

/**
 * Resolve VM hostnames for a manager account:
 * manager → Zentera Role(s) on User_Roles → Server_Profiles hostnames.
 *
 * When multiple hostnames match, candidates are sorted alphabetically and the
 * first is chosen; `hadMultipleCandidates` is set so the UI can flag ambiguity.
 */
export function resolveVmHostnameFromManager(
  managerAccount: string,
  indexes: ZenteraIndexes,
): VmHostnameLookupResult {
  const account = normalizeAccount(managerAccount);
  if (!account) {
    return {
      vmHostname: "",
      source: "",
      candidateHostnames: [],
      hadMultipleCandidates: false,
    };
  }

  const roles = indexes.rolesByUser.get(account);
  if (!roles || roles.size === 0) {
    return {
      vmHostname: "",
      source: "",
      candidateHostnames: [],
      hadMultipleCandidates: false,
    };
  }

  const candidates = new Set<string>();
  for (const role of roles) {
    for (const hostname of indexes.hostnamesByRole.get(role) ?? []) {
      candidates.add(hostname);
    }
  }

  const sorted = [...candidates].sort((left, right) => left.localeCompare(right));
  if (sorted.length === 0) {
    return {
      vmHostname: "",
      source: "",
      candidateHostnames: [],
      hadMultipleCandidates: false,
    };
  }

  return {
    vmHostname: sorted[0] ?? "",
    source: "zentera",
    candidateHostnames: sorted,
    hadMultipleCandidates: sorted.length > 1,
  };
}

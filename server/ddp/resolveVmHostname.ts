import type { ExtractedHostnames } from "./extractHostnamesFromDescription";
import { resolveVmHostnameFromManager } from "../zentera/resolveVmHostnameFromManager";
import type { ZenteraIndexes } from "../zentera/types";

export type ResolvedVmHostname = {
  vmHostname: string;
  source: "description" | "zentera" | "";
  hadInvalidVmFromDescription: boolean;
  hadMultipleZenteraCandidates: boolean;
};

/**
 * VM resolution order:
 * 1. Valid hostname in ticket description
 * 2. Applicant's manager → manager's Zentera roles → server hostnames
 */
export function resolveVmHostname(options: {
  description: ExtractedHostnames;
  /** Direct manager sAMAccountName of the applicant (from LDAP). */
  managerAccount: string;
  zentera: ZenteraIndexes | null;
}): ResolvedVmHostname {
  const hadInvalidVmFromDescription = options.description.hadInvalidVm;

  if (options.description.vmHostname) {
    return {
      vmHostname: options.description.vmHostname,
      source: "description",
      hadInvalidVmFromDescription,
      hadMultipleZenteraCandidates: false,
    };
  }

  if (!options.zentera) {
    return {
      vmHostname: "",
      source: "",
      hadInvalidVmFromDescription,
      hadMultipleZenteraCandidates: false,
    };
  }

  const fromZentera = resolveVmHostnameFromManager(options.managerAccount, options.zentera);
  return {
    vmHostname: fromZentera.vmHostname,
    source: fromZentera.source,
    hadInvalidVmFromDescription,
    hadMultipleZenteraCandidates: fromZentera.hadMultipleCandidates,
  };
}

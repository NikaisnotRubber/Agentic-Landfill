import { deriveRoleCodeFromVmHostname } from "../../server/zentera/deriveRoleFromVmHostname";

export function inferRoleFromVmHostname(vmHostname: string): string {
  return deriveRoleCodeFromVmHostname(vmHostname);
}

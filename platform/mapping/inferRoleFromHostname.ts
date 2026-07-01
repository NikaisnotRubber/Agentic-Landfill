export function inferRoleFromVmHostname(vmHostname: string): string {
  return /([A-Za-z]{2})\d+$/.exec(vmHostname.trim())?.[1]?.toUpperCase() ?? "";
}

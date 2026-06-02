/**
 * Notebook rule: extract two-letter site/role code before trailing digits on VM hostname.
 * @see Mapping ADGroup、Zentera/docs/ddp_analysis_review.md §Role
 */
export function deriveRoleCodeFromVmHostname(vmHostname: string): string {
  const trimmed = vmHostname.trim();
  if (!trimmed) {
    return "";
  }

  const match = /([A-Za-z]{2})\d+$/.exec(trimmed);
  return match?.[1]?.toUpperCase() ?? "";
}

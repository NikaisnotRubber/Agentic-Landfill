/** Aligned with `ddp_analysis.ipynb` EXCLUDE_GROUPS. */
export const EXCLUDED_AD_GROUP_NAMES = [
  "L-TW-AUTODESK-PUBLIC",
  "L-TW-BALSME01",
  "L-TW-DDC-PCAP-USER",
  "L-TW-DELTA-VDIAPP01",
  "L-TW-Deltabox3",
  "L-TW-GFTP",
  "L-TW-M365-STD",
  "L-TW-NolimitLocalAdminUser",
  "L-TW-PSO",
  "L-TW-SSLVPN",
  "L-TW-VDI-RDSPOOL-APP",
] as const;

export function isExcludedAdGroup(groupName: string): boolean {
  return (EXCLUDED_AD_GROUP_NAMES as readonly string[]).includes(groupName.trim());
}

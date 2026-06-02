export type AbnormalFlagInput = {
  adAccount: string;
  nbHostname: string;
  vmHostname: string;
  hadInvalidVm: boolean;
  hadMultipleZenteraVmCandidates: boolean;
};

export const ABNORMAL_FLAG_MISSING_AD = "missing-ad-account";
export const ABNORMAL_FLAG_MISSING_NB = "missing-nb-hostname";
export const ABNORMAL_FLAG_INVALID_VM = "invalid-vm-hostname";
export const ABNORMAL_FLAG_MISSING_VM = "missing-vm-hostname";
export const ABNORMAL_FLAG_AMBIGUOUS_VM = "ambiguous-vm-hostname";

/** Shared by Processed DDP rows and Excel export (Phase 2A / D1). */
export function buildAbnormalFlags(input: AbnormalFlagInput): string[] {
  const flags: string[] = [];

  if (!input.adAccount) {
    flags.push(ABNORMAL_FLAG_MISSING_AD);
  }
  if (!input.nbHostname) {
    flags.push(ABNORMAL_FLAG_MISSING_NB);
  }
  if (input.hadInvalidVm) {
    flags.push(ABNORMAL_FLAG_INVALID_VM);
  }
  if (!input.vmHostname && !input.hadInvalidVm) {
    flags.push(ABNORMAL_FLAG_MISSING_VM);
  }
  if (input.hadMultipleZenteraVmCandidates) {
    flags.push(ABNORMAL_FLAG_AMBIGUOUS_VM);
  }

  return flags;
}

/** Maps processed abnormal flags to Excel「異常」issue labels. */
export function abnormalFlagsToExcelIssues(
  flags: string[],
  invalidVmValue: string,
): string[] {
  const issues: string[] = [];

  for (const flag of flags) {
    switch (flag) {
      case ABNORMAL_FLAG_MISSING_AD:
        issues.push("AD Account");
        break;
      case ABNORMAL_FLAG_MISSING_NB:
        issues.push("NB Hostname");
        break;
      case ABNORMAL_FLAG_INVALID_VM:
        if (invalidVmValue) {
          issues.push(`VM HostName(無效值:${invalidVmValue})`);
        } else {
          issues.push("VM HostName(無效值)");
        }
        break;
      case ABNORMAL_FLAG_MISSING_VM:
        issues.push("VM HostName");
        break;
      case ABNORMAL_FLAG_AMBIGUOUS_VM:
        issues.push("VM HostName(多筆候選)");
        break;
      default:
        break;
    }
  }

  return issues;
}

export function hasExcelAbnormal(flags: string[]): boolean {
  return flags.length > 0;
}

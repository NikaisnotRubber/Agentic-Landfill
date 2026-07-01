import { readFile } from "node:fs/promises";
import { parse } from "csv-parse/sync";
import {
  vmMasterCsvColumns,
  type VmMasterAssignment,
  type VmMasterCsvColumn,
  type VmMasterCsvRecord,
} from "./types";

function clean(value: string | undefined): string {
  return (value ?? "").trim();
}

function assertCsvColumns(
  record: Partial<Record<VmMasterCsvColumn, string>>,
): asserts record is VmMasterCsvRecord {
  const missingColumns = vmMasterCsvColumns.filter((column) => !(column in record));

  if (missingColumns.length > 0) {
    throw new Error(`VM master CSV is missing columns: ${missingColumns.join(", ")}`);
  }
}

export function normalizeVmMasterRecord(record: VmMasterCsvRecord): VmMasterAssignment {
  return {
    adName: clean(record.AD_NAME),
    chnName: clean(record.CHN_NAME),
    emailAddress: clean(record.EMAIL_ADDRESS),
    bg: clean(record.BG),
    bu: clean(record.BU),
    userRole: clean(record.USER_ROLE),
    groupName: clean(record.GROUP_NAME),
    vmName: clean(record.VM_NAME),
    maxOnlineUsers: null,
    zenteraRole: clean(record.ZENTERA_ROLE),
    userDept: clean(record.USER_DEPT),
    reportTo: clean(record.REPORT_TO),
    buCurr: clean(record.BU_CURR),
    bgCurr: clean(record.BG_CURR),
  };
}

export async function readVmMasterCsv(filePath: string): Promise<VmMasterAssignment[]> {
  const input = await readFile(filePath, "utf8");
  const records = parse(input, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: false,
  }) as Array<Partial<Record<VmMasterCsvColumn, string>>>;

  return records.map((record, index) => {
    assertCsvColumns(record);
    const normalized = normalizeVmMasterRecord(record);

    if (!normalized.adName || !normalized.vmName) {
      throw new Error(`VM master CSV row ${index + 2} must include AD_NAME and VM_NAME`);
    }

    return normalized;
  });
}

import type { VmMasterExcelImportField, VmMasterExcelImportMapping } from "./types";

export function getDisabledImportFields(
  mapping: VmMasterExcelImportMapping,
  currentHeader: string,
): Set<VmMasterExcelImportField> {
  return new Set(
    Object.entries(mapping)
      .filter(([header]) => header !== currentHeader)
      .map(([, field]) => field)
      .filter((field): field is VmMasterExcelImportField => Boolean(field)),
  );
}

export function updateImportMapping(
  mapping: VmMasterExcelImportMapping,
  header: string,
  field: VmMasterExcelImportField | "",
): VmMasterExcelImportMapping {
  const next = { ...mapping };
  if (!field) {
    delete next[header];
    return next;
  }

  next[header] = field;
  return next;
}
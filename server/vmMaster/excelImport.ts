import ExcelJS from "exceljs";
import type { AdLookupClient } from "../ad/ldapClient";
import { resolveAdChineseName, resolveAdEnglishName } from "../ad/normalizeAdEntry";
import type { VmMasterDatabase } from "../db/sqlite";
import {
  findAssignmentDefaultsForVm,
  findManagerAdName,
  findManagerAssignments,
  findVmUserForImport,
  replaceUserVmAssignments,
  upsertVmUserForSync,
} from "./repository";
import { writeHelpdeskVmSyncLog } from "./syncLog";
import type {
  VmAssignmentInput,
  VmMasterExcelImportRequestSummary,
  VmMasterExcelImportSummary,
  VmMasterExcelImportWarning,
  VmUserSyncInput,
} from "./types";

export const vmMasterExcelImportFields = [
  "AD_NAME",
  "CHN_NAME",
  "EMAIL_ADDRESS",
  "BG",
  "BU",
  "USER_ROLE",
  "GROUP_NAME",
  "VM_NAME",
  "MAX_ONLINE_USERS",
  "ZENTERA_ROLE",
  "USER_DEPT",
  "REPORT_TO",
  "BU_CURR",
  "BG_CURR",
  "WORK_SHEET",
] as const;

export type VmMasterExcelImportField = (typeof vmMasterExcelImportFields)[number];
export type VmMasterExcelImportMapping = Record<string, VmMasterExcelImportField>;

export type VmMasterExcelPreviewSampleRow = {
  worksheetName?: string;
  rowNumber: number;
  values: Record<string, string>;
};

export type VmMasterExcelPreviewWorksheet = {
  worksheetName: string;
  rowCount: number;
  headers: string[];
};

export type VmMasterExcelPreview = {
  fileName: string;
  worksheetName: string;
  worksheets: VmMasterExcelPreviewWorksheet[];
  headers: string[];
  rowCount: number;
  sampleRows: VmMasterExcelPreviewSampleRow[];
  importableFields: readonly VmMasterExcelImportField[];
  defaultMapping: Partial<Record<string, VmMasterExcelImportField>>;
};

export type VmMasterExcelImportInput = {
  fileName: string;
  workbookBuffer: Buffer;
  mapping: Partial<Record<string, unknown>>;
  changedBy?: string;
};

export type VmMasterExcelImportDeps = {
  database: VmMasterDatabase;
  createLookupClient: () => AdLookupClient;
  startedAt?: string;
  logDir?: string;
};

export type VmMasterExcelImportResult =
  | {
      ok: true;
      summary: VmMasterExcelImportSummary;
      requestSummary: VmMasterExcelImportRequestSummary;
    }
  | { ok: false; error: string; logId?: string; logPath?: string };

type HeaderColumn = {
  header: string;
  columnNumber: number;
};

type ParsedExcelRow = {
  worksheetName: string;
  rowNumber: number;
  values: Record<string, string>;
};

type ParsedWorksheetRows = {
  worksheetName: string;
  worksheets: VmMasterExcelPreviewWorksheet[];
  headers: string[];
  rows: ParsedExcelRow[];
};

const fieldsByNormalizedName = new Map(
  vmMasterExcelImportFields.map((field) => [normalizeFieldName(field), field] as const),
);

function normalizeFieldName(value: string): string {
  return value.trim().toUpperCase().replace(/[\s_-]/g, "");
}

function toCellText(value: ExcelJS.CellValue): string {
  if (value == null) {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value !== "object") {
    return String(value).trim();
  }

  if ("result" in value && value.result != null) {
    return toCellText(value.result as ExcelJS.CellValue);
  }

  if ("formula" in value && typeof value.formula === "string") {
    return value.formula.trim();
  }

  if ("richText" in value && Array.isArray(value.richText)) {
    return value.richText
      .map((part) => (typeof part?.text === "string" ? part.text : ""))
      .join("")
      .trim();
  }

  if ("text" in value && typeof value.text === "string") {
    return value.text.trim();
  }

  if ("hyperlink" in value && typeof value.hyperlink === "string") {
    return value.hyperlink.trim();
  }

  if ("error" in value && typeof value.error === "string") {
    return value.error.trim();
  }

  return "";
}

function readHeaderColumns(worksheet: ExcelJS.Worksheet): HeaderColumn[] {
  const headers: HeaderColumn[] = [];
  const seenHeaders = new Set<string>();

  worksheet.getRow(1).eachCell({ includeEmpty: true }, (cell, columnNumber) => {
    const header = toCellText(cell.value);

    if (!header) {
      return;
    }

    if (seenHeaders.has(header)) {
      throw new Error(`Duplicate VM Master Excel header: ${header}`);
    }

    seenHeaders.add(header);
    headers.push({ header, columnNumber });
  });

  return headers;
}

function rowHasData(row: ExcelJS.Row, headers: HeaderColumn[]): boolean {
  for (const { columnNumber } of headers) {
    if (toCellText(row.getCell(columnNumber).value)) {
      return true;
    }
  }

  return false;
}

function readSampleValues(row: ExcelJS.Row, headers: HeaderColumn[]): Record<string, string> {
  const values: Record<string, string> = {};

  for (const { header, columnNumber } of headers) {
    values[header] = toCellText(row.getCell(columnNumber).value);
  }

  return values;
}

async function loadWorkbook(workbookBuffer: Buffer): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(workbookBuffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  return workbook;
}

function addHeader(headers: string[], seenHeaders: Set<string>, header: string): void {
  if (!seenHeaders.has(header)) {
    seenHeaders.add(header);
    headers.push(header);
  }
}

async function readWorkbookRows(workbookBuffer: Buffer): Promise<ParsedWorksheetRows> {
  const workbook = await loadWorkbook(workbookBuffer);
  const headers: string[] = [];
  const seenHeaders = new Set<string>();
  const rows: ParsedExcelRow[] = [];
  const worksheets: VmMasterExcelPreviewWorksheet[] = [];
  let foundHeaders = false;

  for (const worksheet of workbook.worksheets) {
    const headerColumns = readHeaderColumns(worksheet);

    if (headerColumns.length === 0) {
      continue;
    }

    foundHeaders = true;
    const worksheetHeaders = headerColumns.map(({ header }) => header);
    const worksheetRows: ParsedExcelRow[] = [];

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);

      if (!rowHasData(row, headerColumns)) {
        continue;
      }

      const values = readSampleValues(row, headerColumns);
      values.WORK_SHEET = worksheet.name;
      worksheetRows.push({ worksheetName: worksheet.name, rowNumber, values });
    }

    if (worksheetRows.length === 0) {
      continue;
    }

    for (const header of worksheetHeaders) {
      addHeader(headers, seenHeaders, header);
    }
    addHeader(headers, seenHeaders, "WORK_SHEET");

    worksheets.push({
      worksheetName: worksheet.name,
      rowCount: worksheetRows.length,
      headers: worksheetHeaders.includes("WORK_SHEET") ? worksheetHeaders : [...worksheetHeaders, "WORK_SHEET"],
    });
    rows.push(...worksheetRows);
  }

  if (workbook.worksheets.length === 0) {
    throw new Error("VM Master Excel import requires a worksheet with headers and data");
  }

  if (!foundHeaders) {
    throw new Error("VM Master Excel import requires header columns");
  }

  if (rows.length === 0) {
    throw new Error("VM Master Excel import requires at least one data row");
  }

  return {
    worksheetName: worksheets.map((worksheet) => worksheet.worksheetName).join(", "),
    worksheets,
    headers,
    rows,
  };
}

export function buildDefaultExcelImportMapping(
  headers: string[],
): Partial<Record<string, VmMasterExcelImportField>> {
  const mapping: Partial<Record<string, VmMasterExcelImportField>> = {};

  for (const header of headers) {
    const field = fieldsByNormalizedName.get(normalizeFieldName(header));

    if (field) {
      mapping[header] = field;
    }
  }

  return mapping;
}

export function validateVmMasterExcelMapping(
  mapping: Partial<Record<string, unknown>>,
): VmMasterExcelImportMapping {
  const normalizedMapping: VmMasterExcelImportMapping = {};
  const seenFields = new Set<VmMasterExcelImportField>();

  for (const [header, rawField] of Object.entries(mapping)) {
    if (rawField == null) {
      continue;
    }

    if (typeof rawField !== "string") {
      throw new Error(`Invalid VM Master import target field: ${rawField}`);
    }

    const trimmedField = rawField.trim();

    if (!trimmedField) {
      continue;
    }

    const field = fieldsByNormalizedName.get(normalizeFieldName(trimmedField));

    if (!field) {
      throw new Error(`Invalid VM Master import target field: ${rawField}`);
    }

    if (seenFields.has(field)) {
      throw new Error(`Duplicate VM Master import target field: ${rawField}`);
    }

    seenFields.add(field);
    normalizedMapping[header] = field;
  }

  if (!seenFields.has("AD_NAME")) {
    throw new Error("VM Master Excel import requires an AD_NAME mapping");
  }

  return normalizedMapping;
}

export async function parseVmMasterExcelPreview({
  fileName,
  workbookBuffer,
}: {
  fileName: string;
  workbookBuffer: Buffer;
}): Promise<VmMasterExcelPreview> {
  const worksheet = await readWorkbookRows(workbookBuffer);
  const includeWorksheetName = worksheet.worksheets.length > 1;
  const sampleRows = worksheet.rows.slice(0, 5).map((row) => ({
    ...(includeWorksheetName ? { worksheetName: row.worksheetName } : {}),
    rowNumber: row.rowNumber,
    values: row.values,
  }));

  return {
    fileName,
    worksheetName: worksheet.worksheetName,
    worksheets: worksheet.worksheets,
    headers: worksheet.headers,
    rowCount: worksheet.rows.length,
    sampleRows,
    importableFields: vmMasterExcelImportFields,
    defaultMapping: buildDefaultExcelImportMapping(worksheet.headers),
  };
}

function fieldValue(
  values: Record<string, string>,
  mapping: VmMasterExcelImportMapping,
  field: VmMasterExcelImportField,
): string {
  const source = Object.entries(mapping).find(([, target]) => target === field)?.[0];
  return source ? values[source]?.trim() ?? "" : "";
}

function createEmptySummary(rowCount: number): VmMasterExcelImportSummary {
  return {
    rowCount,
    importedRowCount: 0,
    failedRowCount: 0,
    adEnrichedCount: 0,
    dbFilledCount: 0,
    managerInferredAssignmentCount: 0,
    explicitAssignmentCount: 0,
    warnings: [],
  };
}

function createWarning(input: {
  rowNumber: number;
  stage: VmMasterExcelImportWarning["stage"];
  code: string;
  message: string;
  adName?: string;
  field?: string;
  detail?: string;
}): VmMasterExcelImportWarning {
  return {
    rowNumber: input.rowNumber,
    stage: input.stage,
    code: input.code,
    message: input.message,
    adName: input.adName || undefined,
    field: input.field,
    detail: input.detail,
  };
}

function buildRequestSummary(input: {
  fileName: string;
  worksheetName: string;
  rows: ParsedExcelRow[];
  mapping: VmMasterExcelImportMapping;
  mappedFields: string[];
}): VmMasterExcelImportRequestSummary {
  return {
    fileName: input.fileName,
    worksheetName: input.worksheetName,
    excelRowCount: input.rows.length,
    mappedColumnCount: Object.keys(input.mapping).length,
    mappedFields: input.mappedFields,
    rows: input.rows.slice(0, 5).map((row) => ({
      worksheetName: row.worksheetName,
      rowNumber: row.rowNumber,
      adName: fieldValue(row.values, input.mapping, "AD_NAME"),
      vmName: fieldValue(row.values, input.mapping, "VM_NAME") || undefined,
    })),
  };
}

function chooseValue(...values: Array<string | undefined>): string {
  for (const value of values) {
    const trimmed = value?.trim() ?? "";
    if (trimmed) {
      return trimmed;
    }
  }
  return "";
}

async function resolveReportTo(input: {
  values: Record<string, string>;
  mapping: VmMasterExcelImportMapping;
  lookupClient: AdLookupClient;
  lookupManagerAccount?: AdLookupClient["lookupManagerAccount"];
  user: Awaited<ReturnType<AdLookupClient["lookupUser"]>>;
  existingReportTo: string;
  onManagerLookupError?: (error: unknown) => void;
}): Promise<string> {
  const explicitReportTo = fieldValue(input.values, input.mapping, "REPORT_TO");
  if (explicitReportTo) {
    return explicitReportTo;
  }

  if (input.user?.managerDn) {
    try {
      const lookupManagerAccount = input.lookupManagerAccount ?? input.lookupClient.lookupManagerAccount.bind(input.lookupClient);
      const manager = await lookupManagerAccount(input.user.managerDn);
      if (manager?.adAccount) {
        return manager.adAccount;
      }
    } catch (error) {
      input.onManagerLookupError?.(error);
    }
  }

  return chooseValue(resolveAdEnglishName(input.user?.manager ?? ""), input.existingReportTo);
}

function buildUserInput(input: {
  adName: string;
  values: Record<string, string>;
  mapping: VmMasterExcelImportMapping;
  user: Awaited<ReturnType<AdLookupClient["lookupUser"]>>;
  existing: ReturnType<typeof findVmUserForImport>;
  reportTo: string;
}): { userInput: VmUserSyncInput; usedDbFallback: boolean } {
  let usedDbFallback = false;
  const chooseWithDb = (excelValue: string, adValue: string, dbValue?: string): string => {
    const direct = chooseValue(excelValue, adValue);
    if (direct) {
      return direct;
    }

    const fallback = dbValue?.trim() ?? "";
    if (fallback) {
      usedDbFallback = true;
    }
    return fallback;
  };

  const userInput = {
    adName: input.adName,
    chnName: chooseWithDb(
      fieldValue(input.values, input.mapping, "CHN_NAME"),
      resolveAdChineseName(input.user?.displayName ?? ""),
      input.existing?.chnName,
    ),
    emailAddress: chooseWithDb(
      fieldValue(input.values, input.mapping, "EMAIL_ADDRESS"),
      input.user?.mail ?? "",
      input.existing?.emailAddress,
    ),
    bg: chooseWithDb(fieldValue(input.values, input.mapping, "BG"), input.user?.bg ?? "", input.existing?.bg),
    bu: chooseWithDb(fieldValue(input.values, input.mapping, "BU"), input.user?.bu ?? "", input.existing?.bu),
    userRole: chooseWithDb(
      fieldValue(input.values, input.mapping, "USER_ROLE"),
      "",
      input.existing?.userRole,
    ),
    userDept: chooseWithDb(
      fieldValue(input.values, input.mapping, "USER_DEPT"),
      input.user?.department ?? "",
      input.existing?.userDept,
    ),
    reportTo: input.reportTo,
  };

  return { userInput, usedDbFallback };
}

function buildExplicitAssignment(
  values: Record<string, string>,
  mapping: VmMasterExcelImportMapping,
  findDefaults: (vmName: string) => VmAssignmentInput | null,
): VmAssignmentInput | null {
  const vmName = fieldValue(values, mapping, "VM_NAME");
  if (!vmName) {
    return null;
  }

  const defaults = findDefaults(vmName);

  return {
    vmName,
    groupName: chooseValue(fieldValue(values, mapping, "GROUP_NAME"), defaults?.groupName),
    zenteraRole: chooseValue(fieldValue(values, mapping, "ZENTERA_ROLE"), defaults?.zenteraRole),
    workSheet: fieldValue(values, mapping, "WORK_SHEET"),
  };
}

function parseMaxOnlineUsers(value: string): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error("MAX_ONLINE_USERS must be a non-negative integer");
  }
  return parsed;
}

function applyUserCurrentOverrides(
  database: VmMasterDatabase,
  adName: string,
  values: Record<string, string>,
  mapping: VmMasterExcelImportMapping,
): void {
  const buCurr = fieldValue(values, mapping, "BU_CURR");
  const bgCurr = fieldValue(values, mapping, "BG_CURR");
  if (!buCurr && !bgCurr) {
    return;
  }

  database
    .prepare(
      `UPDATE vm_users
       SET bu_curr = CASE WHEN ? THEN ? ELSE bu_curr END,
           bg_curr = CASE WHEN ? THEN ? ELSE bg_curr END,
           updated_at = datetime('now')
       WHERE ad_name = ?`,
    )
    .run(Boolean(buCurr) ? 1 : 0, buCurr, Boolean(bgCurr) ? 1 : 0, bgCurr, adName);
}

function applyMachineMaxOnlineUsers(
  database: VmMasterDatabase,
  vmName: string,
  values: Record<string, string>,
  mapping: VmMasterExcelImportMapping,
): void {
  const maxOnlineUsers = parseMaxOnlineUsers(fieldValue(values, mapping, "MAX_ONLINE_USERS"));
  if (maxOnlineUsers === undefined) {
    return;
  }

  database
    .prepare("UPDATE vm_machines SET max_online_users = ?, updated_at = datetime('now') WHERE vm_name = ?")
    .run(maxOnlineUsers, vmName);
}

export async function executeVmMasterExcelImport(
  input: VmMasterExcelImportInput,
  deps: VmMasterExcelImportDeps,
): Promise<VmMasterExcelImportResult> {
  const startedAt = deps.startedAt ?? new Date().toISOString();
  const logs: string[] = [];
  let mapping: VmMasterExcelImportMapping = {};
  let worksheet: ParsedWorksheetRows = { worksheetName: "", worksheets: [], headers: [], rows: [] };
  let mappedFields: string[] = [];
  let summary = createEmptySummary(0);
  let requestSummary: VmMasterExcelImportRequestSummary = buildRequestSummary({
    fileName: input.fileName,
    worksheetName: "",
    rows: [],
    mapping,
    mappedFields,
  });

  function appendLog(level: "INFO" | "WARN" | "ERROR", message: string): void {
    logs.push(`${new Date().toISOString()} ${level} ${message}`);
  }

  function appendWarning(warning: VmMasterExcelImportWarning): void {
    summary.warnings.push(warning);
    appendLog("WARN", `${warning.stage} row=${warning.rowNumber} ${warning.code} ${warning.message}`);
  }

  async function writeLog(ok: boolean, error?: string): Promise<{ id?: string; logPath?: string }> {
    try {
      const { id, logPath } = await writeHelpdeskVmSyncLog(
        {
          kind: "excel-import",
          startedAt,
          finishedAt: new Date().toISOString(),
          ok,
          options: {
            fileName: input.fileName,
            worksheetName: worksheet.worksheetName,
            rowCount: worksheet.rows.length,
            mappedFields,
          },
          requestSummary,
          summary,
          warnings: summary.warnings,
          logs,
          error,
        },
        { logDir: deps.logDir },
      );
      return { id, logPath };
    } catch (logError) {
      summary.warnings.push(
        createWarning({
          rowNumber: 0,
          stage: "db",
          code: "log-write-failed",
          message: logError instanceof Error ? logError.message : "Excel import log write failed",
        }),
      );
      return {};
    }
  }

  try {
    mapping = validateVmMasterExcelMapping(input.mapping);
    worksheet = await readWorkbookRows(input.workbookBuffer);
    mappedFields = Object.values(mapping);
    summary = createEmptySummary(worksheet.rows.length);
    requestSummary = buildRequestSummary({
      fileName: input.fileName,
      worksheetName: worksheet.worksheetName,
      rows: worksheet.rows,
      mapping,
      mappedFields,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "VM Master Excel import failed";
    appendLog("ERROR", message);
    const logResult = await writeLog(false, message);
    return { ok: false, error: message, logId: logResult.id, logPath: logResult.logPath };
  }

  let lookupClient: AdLookupClient;
  try {
    lookupClient = deps.createLookupClient();
  } catch (error) {
    const message = error instanceof Error ? error.message : "AD lookup client creation failed";
    appendLog("ERROR", message);
    const logResult = await writeLog(false, message);
    return { ok: false, error: message, logId: logResult.id, logPath: logResult.logPath };
  }
  type UserLookupOutcome =
    | { user: Awaited<ReturnType<AdLookupClient["lookupUser"]>>; error?: undefined }
    | { user: null; error: unknown };
  const existingUserCache = new Map<string, ReturnType<typeof findVmUserForImport>>();
  const userLookupCache = new Map<string, Promise<UserLookupOutcome>>();
  const managerAccountCache = new Map<string, ReturnType<AdLookupClient["lookupManagerAccount"]>>();
  const managerAdNameCache = new Map<string, string>();
  const managerAssignmentsCache = new Map<string, VmAssignmentInput[]>();
  const assignmentDefaultsCache = new Map<string, VmAssignmentInput | null>();

  function findExistingUser(adName: string): ReturnType<typeof findVmUserForImport> {
    if (!existingUserCache.has(adName)) {
      existingUserCache.set(adName, findVmUserForImport(deps.database, adName));
    }
    return existingUserCache.get(adName) ?? null;
  }

  function lookupUserCached(adName: string): Promise<UserLookupOutcome> {
    if (!userLookupCache.has(adName)) {
      userLookupCache.set(
        adName,
        lookupClient.lookupUser(adName).then(
          (user) => ({ user }),
          (error: unknown) => ({ user: null, error }),
        ),
      );
    }
    return userLookupCache.get(adName) as Promise<UserLookupOutcome>;
  }

  function lookupManagerAccountCached(managerDn: string): ReturnType<AdLookupClient["lookupManagerAccount"]> {
    if (!managerAccountCache.has(managerDn)) {
      managerAccountCache.set(managerDn, lookupClient.lookupManagerAccount(managerDn));
    }
    return managerAccountCache.get(managerDn) as ReturnType<AdLookupClient["lookupManagerAccount"]>;
  }

  function findManagerAdNameCached(reportTo: string): string {
    const key = reportTo.trim();
    if (!managerAdNameCache.has(key)) {
      managerAdNameCache.set(key, findManagerAdName(deps.database, key));
    }
    return managerAdNameCache.get(key) ?? "";
  }

  function findManagerAssignmentsCached(managerAdName: string): VmAssignmentInput[] {
    if (!managerAssignmentsCache.has(managerAdName)) {
      managerAssignmentsCache.set(managerAdName, findManagerAssignments(deps.database, managerAdName));
    }
    return managerAssignmentsCache.get(managerAdName) ?? [];
  }

  function findAssignmentDefaultsCached(vmName: string): VmAssignmentInput | null {
    if (!assignmentDefaultsCache.has(vmName)) {
      assignmentDefaultsCache.set(vmName, findAssignmentDefaultsForVm(deps.database, vmName));
    }
    return assignmentDefaultsCache.get(vmName) ?? null;
  }

  try {
    appendLog("INFO", `starting VM Master Excel import rows=${worksheet.rows.length}`);

    for (const row of worksheet.rows) {
      const adName = fieldValue(row.values, mapping, "AD_NAME");
      if (!adName) {
        summary.failedRowCount += 1;
        appendWarning(
          createWarning({
            rowNumber: row.rowNumber,
            stage: "mapping",
            code: "missing-ad-name",
            message: "Excel row did not include AD_NAME",
            field: "AD_NAME",
          }),
        );
        continue;
      }

      const existing = findExistingUser(adName);
      const userLookup = await lookupUserCached(adName);
      let user: Awaited<ReturnType<AdLookupClient["lookupUser"]>> = null;
      if ("error" in userLookup) {
        appendWarning(
          createWarning({
            rowNumber: row.rowNumber,
            stage: "ad-enrichment",
            code: "lookup-failed",
            message: `AD lookup failed for ${adName}`,
            adName,
            detail: userLookup.error instanceof Error ? userLookup.error.message : String(userLookup.error),
          }),
        );
        if (!existing) {
          summary.failedRowCount += 1;
          continue;
        }
      } else {
        user = userLookup.user;
      }

      if (!user) {
        appendWarning(
          createWarning({
            rowNumber: row.rowNumber,
            stage: "ad-enrichment",
            code: "user-not-found",
            message: `AD user not found for ${adName}`,
            adName,
          }),
        );
        if (!existing) {
          summary.failedRowCount += 1;
          continue;
        }
      } else {
        summary.adEnrichedCount += 1;
      }
      const reportTo = await resolveReportTo({
        values: row.values,
        mapping,
        lookupClient,
        lookupManagerAccount: lookupManagerAccountCached,
        user,
        existingReportTo: existing?.reportTo ?? "",
        onManagerLookupError: (error) => {
          appendWarning(
            createWarning({
              rowNumber: row.rowNumber,
              stage: "ad-enrichment",
              code: "manager-account-lookup-failed",
              message: `manager account lookup failed for ${adName}`,
              adName,
              detail: error instanceof Error ? error.message : String(error),
            }),
          );
        },
      });
      const { userInput, usedDbFallback } = buildUserInput({
        adName,
        values: row.values,
        mapping,
        user,
        existing,
        reportTo,
      });
      if (usedDbFallback) {
        summary.dbFilledCount += 1;
      }

      deps.database.exec("BEGIN");
      try {
        upsertVmUserForSync(deps.database, userInput);
        applyUserCurrentOverrides(deps.database, adName, row.values, mapping);

        const explicitAssignment = buildExplicitAssignment(row.values, mapping, findAssignmentDefaultsCached);
        if (explicitAssignment) {
          replaceUserVmAssignments(deps.database, adName, [explicitAssignment]);
          applyMachineMaxOnlineUsers(deps.database, explicitAssignment.vmName, row.values, mapping);
          summary.explicitAssignmentCount += 1;
          summary.importedRowCount += 1;
          deps.database.exec("COMMIT");
          appendLog("INFO", `imported ${adName} with explicit VM ${explicitAssignment.vmName}`);
          continue;
        }

        const managerAdName = findManagerAdNameCached(reportTo);
        if (!managerAdName) {
          summary.failedRowCount += 1;
          appendWarning(
            createWarning({
              rowNumber: row.rowNumber,
              stage: "vm-inference",
              code: "manager-not-found",
              message: `manager not found for ${adName}`,
              adName,
              detail: `REPORT_TO=${reportTo}`,
            }),
          );
          deps.database.exec("ROLLBACK");
          continue;
        }

        const workSheet = fieldValue(row.values, mapping, "WORK_SHEET");
        const managerAssignments = findManagerAssignmentsCached(managerAdName).map((assignment) => ({
          ...assignment,
          workSheet,
        }));
        if (managerAssignments.length === 0) {
          summary.failedRowCount += 1;
          appendWarning(
            createWarning({
              rowNumber: row.rowNumber,
              stage: "vm-inference",
              code: "manager-has-no-vm-assignments",
              message: `manager has no VM assignments for ${adName}`,
              adName,
              detail: `managerAdName=${managerAdName}`,
            }),
          );
          deps.database.exec("ROLLBACK");
          continue;
        }

        const replacement = replaceUserVmAssignments(deps.database, adName, managerAssignments);
        summary.managerInferredAssignmentCount += replacement.insertedCount;
        summary.importedRowCount += 1;
        deps.database.exec("COMMIT");
        appendLog(
          "INFO",
          `imported ${adName} from manager ${managerAdName}: ${replacement.insertedCount} assignments inserted`,
        );
      } catch (error) {
        deps.database.exec("ROLLBACK");
        summary.failedRowCount += 1;
        appendWarning(
          createWarning({
            rowNumber: row.rowNumber,
            stage: "db",
            code: "row-import-failed",
            message: `DB import failed for ${adName}`,
            adName,
            detail: error instanceof Error ? error.message : String(error),
          }),
        );
      }
    }

    const failed = summary.importedRowCount === 0;
    const error = failed ? "VM Master Excel import did not import any rows" : undefined;
    const logResult = await writeLog(!failed, error);
    if (logResult.id) {
      summary.logId = logResult.id;
      summary.logPath = logResult.logPath;
    }

    if (failed) {
      return { ok: false, error: error ?? "VM Master Excel import failed", logId: logResult.id, logPath: logResult.logPath };
    }

    return { ok: true, summary, requestSummary };
  } finally {
    await lookupClient.close();
  }
}
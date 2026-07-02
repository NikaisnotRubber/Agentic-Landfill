export type VmMasterPreviewRow = {
  bg: string;
  adName: string;
  chnName: string;
  emailAddress: string;
  bu: string;
  userRole: string;
  userDept: string;
  reportTo: string;
  buCurr: string;
  bgCurr: string;
  groupName: string;
  vmName: string;
  maxOnlineUsers: number | null;
  zenteraRole: string;
};

export type VmMasterBgGroup = {
  bg: string;
  assignmentCount: number;
  userCount: number;
  vmCount: number;
  rows: VmMasterPreviewRow[];
};

export type VmMasterPreviewSuccess = {
  ok: true;
  groups: VmMasterBgGroup[];
};

export type VmMasterPreviewFailure = {
  ok: false;
  error: string;
};

export type VmMasterPreviewResult = VmMasterPreviewSuccess | VmMasterPreviewFailure;

export type VmMasterManualEditChange = {
  originalAdName: string;
  originalVmName: string;
  row: VmMasterPreviewRow;
};

export type VmMasterManualEditCommand = {
  changedBy?: string;
  changes: VmMasterManualEditChange[];
};

export type VmMasterManualEditCommandResult =
  | { ok: true; commandId: string; updatedCount: number }
  | { ok: false; error: string };

export type HelpdeskVmSyncOptions = {
  count: number;
  technician?: string;
  filterId?: string;
  stateFile?: string;
  ddpOnly?: boolean;
};

export type HelpdeskVmSyncWarningStage =
  | "ticket-parse"
  | "ldap"
  | "manager-resolution"
  | "vm-inference"
  | "db";

export type HelpdeskVmSyncWarning = {
  ticketId: string;
  stage: HelpdeskVmSyncWarningStage;
  code: string;
  message: string;
  adName?: string;
  detail?: string;
};

export type HelpdeskVmSyncSummary = {
  fetchedTicketCount: number;
  parsedTicketCount: number;
  ldapEnrichedCount: number;
  skippedTicketCount: number;
  managerMatchedCount: number;
  userUpsertedCount: number;
  assignmentReplacedCount: number;
  assignmentInsertedCount: number;
  warnings: HelpdeskVmSyncWarning[];
  logId?: string;
  logPath?: string;
};

export type HelpdeskVmSyncResult =
  | { ok: true; summary: HelpdeskVmSyncSummary }
  | { ok: false; error: string; logId?: string; logPath?: string };

export type VmMasterExecutionKind = "helpdesk-sync" | "excel-import";

export type VmMasterExcelImportField =
  | "AD_NAME"
  | "CHN_NAME"
  | "EMAIL_ADDRESS"
  | "BG"
  | "BU"
  | "USER_ROLE"
  | "GROUP_NAME"
  | "VM_NAME"
  | "MAX_ONLINE_USERS"
  | "ZENTERA_ROLE"
  | "USER_DEPT"
  | "REPORT_TO"
  | "BU_CURR"
  | "BG_CURR";

export type VmMasterExcelImportMapping = Partial<Record<string, VmMasterExcelImportField>>;

export type VmMasterExcelPreviewSampleRow = {
  rowNumber: number;
  values: Record<string, string>;
};

export type VmMasterExcelPreviewResult =
  | {
      ok: true;
      fileName: string;
      worksheetName: string;
      headers: string[];
      rowCount: number;
      sampleRows: VmMasterExcelPreviewSampleRow[];
      importableFields: VmMasterExcelImportField[];
      defaultMapping: VmMasterExcelImportMapping;
    }
  | { ok: false; error: string };

export type VmMasterExcelImportWarningStage =
  | "mapping"
  | "ad-enrichment"
  | "db-fill"
  | "vm-inference"
  | "db";

export type VmMasterExcelImportWarning = {
  rowNumber: number;
  stage: VmMasterExcelImportWarningStage;
  code: string;
  message: string;
  adName?: string;
  field?: string;
  detail?: string;
};

export type VmMasterExecutionWarning = HelpdeskVmSyncWarning | VmMasterExcelImportWarning;

export type VmMasterExcelImportSummary = {
  rowCount: number;
  importedRowCount: number;
  failedRowCount: number;
  adEnrichedCount: number;
  dbFilledCount: number;
  managerInferredAssignmentCount: number;
  explicitAssignmentCount: number;
  warnings: VmMasterExcelImportWarning[];
  logId?: string;
  logPath?: string;
};

export type VmMasterExcelImportExecuteResult =
  | { ok: true; summary: VmMasterExcelImportSummary }
  | { ok: false; error: string; logId?: string; logPath?: string };

export type VmMasterHelpdeskSyncRequestSummary = {
  requestedTicketCount: number;
  fetchedTicketCount: number;
  parsedTicketCount: number;
  tickets: Array<{
    ticketId: string;
    requester: string;
    subject: string;
  }>;
};

export type VmMasterExcelImportRequestSummary = {
  fileName: string;
  worksheetName: string;
  excelRowCount: number;
  mappedColumnCount: number;
  mappedFields: string[];
  rows: Array<{
    rowNumber: number;
    adName: string;
    vmName?: string;
  }>;
};

export type VmMasterExecutionRequestSummary =
  | VmMasterHelpdeskSyncRequestSummary
  | VmMasterExcelImportRequestSummary;

export type VmMasterExcelImportOptions = {
  fileName: string;
  worksheetName: string;
  rowCount: number;
  mappedFields: string[];
};

type VmMasterExecutionLogBase = {
  id: string;
  startedAt: string;
  finishedAt: string;
  ok: boolean;
  logs: string[];
  error?: string;
};

export type VmMasterHelpdeskSyncExecutionLogEntry = VmMasterExecutionLogBase & {
  kind: "helpdesk-sync";
  options: HelpdeskVmSyncOptions;
  requestSummary?: VmMasterHelpdeskSyncRequestSummary;
  summary: HelpdeskVmSyncSummary;
  warnings: HelpdeskVmSyncWarning[];
};

export type VmMasterExcelImportExecutionLogEntry = VmMasterExecutionLogBase & {
  kind: "excel-import";
  options: VmMasterExcelImportOptions;
  requestSummary?: VmMasterExcelImportRequestSummary;
  summary: VmMasterExcelImportSummary;
  warnings: VmMasterExcelImportWarning[];
};

export type HelpdeskVmSyncLogEntry =
  | VmMasterHelpdeskSyncExecutionLogEntry
  | VmMasterExcelImportExecutionLogEntry;

export type HelpdeskVmSyncLogListItem = {
  id: string;
  kind: VmMasterExecutionKind;
  startedAt: string;
  finishedAt: string;
  ok: boolean;
  warningCount: number;
  logPath: string;
};

export type HelpdeskVmSyncLogListResult =
  | { ok: true; logs: HelpdeskVmSyncLogListItem[] }
  | { ok: false; error: string };

export type HelpdeskVmSyncLogDetailResult =
  | { ok: true; log: HelpdeskVmSyncLogEntry }
  | { ok: false; error: string };
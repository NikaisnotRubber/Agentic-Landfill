export const vmMasterCsvColumns = [
  "AD_NAME",
  "CHN_NAME",
  "EMAIL_ADDRESS",
  "BG",
  "BU",
  "USER_ROLE",
  "GROUP_NAME",
  "VM_NAME",
  "ZENTERA_ROLE",
  "USER_DEPT",
  "REPORT_TO",
  "BU_CURR",
  "BG_CURR",
  "WORK_SHEET",
] as const;

export type VmMasterCsvColumn = (typeof vmMasterCsvColumns)[number];

export type VmMasterCsvRecord = Record<VmMasterCsvColumn, string>;

export type VmMasterAssignment = {
  adName: string;
  chnName: string;
  emailAddress: string;
  bg: string;
  bu: string;
  userRole: string;
  groupName: string;
  vmName: string;
  maxOnlineUsers: number | null;
  zenteraRole: string;
  userDept: string;
  reportTo: string;
  buCurr: string;
  bgCurr: string;
};

export type VmMasterPreviewRow = VmMasterAssignment;

export type VmMasterBgGroup = {
  bg: string;
  assignmentCount: number;
  userCount: number;
  vmCount: number;
  rows: VmMasterPreviewRow[];
};

export type VmMasterManualEditChange = {
  originalAdName: string;
  originalVmName: string;
  row: VmMasterPreviewRow;
};

export type VmMasterManualEditCommand = {
  changedBy?: string;
  changes: VmMasterManualEditChange[];
};

export type VmMasterManualEditCommandResult = {
  commandId: string;
  updatedCount: number;
};

export type HelpdeskVmTicketParseSuccess = {
  ok: true;
  ticketId: string;
  adName: string;
  userRole: string;
};

export type HelpdeskVmTicketParseFailure = {
  ok: false;
  ticketId: string;
  reason: "missing-ad-name";
};

export type HelpdeskVmTicketParseResult =
  | HelpdeskVmTicketParseSuccess
  | HelpdeskVmTicketParseFailure;

export type VmUserSyncInput = {
  adName: string;
  chnName: string;
  emailAddress: string;
  bg: string;
  bu: string;
  userRole: string;
  userDept: string;
  reportTo: string;
};

export type VmAssignmentInput = {
  vmName: string;
  groupName: string;
  zenteraRole: string;
};

export type HelpdeskVmSyncOptions = {
  count: number;
  technician?: string;
  filterId?: string;
  stateFile?: string;
  ddpOnly?: boolean;
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

export type HelpdeskVmSyncResult =
  | { ok: true; summary: HelpdeskVmSyncSummary }
  | { ok: false; error: string; logId?: string; logPath?: string };

export type VmMasterExecutionKind = "helpdesk-sync" | "excel-import";

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

export type VmMasterExcelImportSummary = {
  rowCount: number;
  importedRowCount: number;
  failedRowCount: number;
  adEnrichedCount: number;
  dbFilledCount: number;
  managerInferredAssignmentCount: number;
  explicitAssignmentCount: number;
  warnings: HelpdeskVmSyncWarning[];
  logId?: string;
  logPath?: string;
};

export type VmMasterExecutionSummary = HelpdeskVmSyncSummary | VmMasterExcelImportSummary;

export type VmMasterExecutionOptions =
  | HelpdeskVmSyncOptions
  | {
      fileName: string;
      worksheetName: string;
      rowCount: number;
      mappedFields: string[];
    };

export type VmMasterExecutionLogEntry = {
  id: string;
  kind: VmMasterExecutionKind;
  startedAt: string;
  finishedAt: string;
  ok: boolean;
  options: VmMasterExecutionOptions;
  requestSummary?: VmMasterExecutionRequestSummary;
  summary: VmMasterExecutionSummary;
  warnings: HelpdeskVmSyncWarning[];
  logs: string[];
  error?: string;
};

export type VmMasterExecutionLogListItem = {
  id: string;
  kind: VmMasterExecutionKind;
  startedAt: string;
  finishedAt: string;
  ok: boolean;
  warningCount: number;
  logPath: string;
};

export type HelpdeskVmSyncLogEntry = VmMasterExecutionLogEntry;

export type HelpdeskVmSyncLogListItem = VmMasterExecutionLogListItem;

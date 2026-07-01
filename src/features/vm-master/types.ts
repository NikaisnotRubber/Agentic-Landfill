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

export type HelpdeskVmSyncLogEntry = {
  id: string;
  startedAt: string;
  finishedAt: string;
  ok: boolean;
  options: HelpdeskVmSyncOptions;
  summary: HelpdeskVmSyncSummary;
  warnings: HelpdeskVmSyncWarning[];
  logs: string[];
  error?: string;
};

export type HelpdeskVmSyncLogListItem = {
  id: string;
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

import type {
  HelpdeskVmSyncLogDetailResult,
  HelpdeskVmSyncLogListResult,
  HelpdeskVmSyncOptions,
  HelpdeskVmSyncResult,
  VmMasterExcelImportExecuteResult,
  VmMasterExcelImportMapping,
  VmMasterExcelPreviewResult,
  VmMasterManualEditCommand,
  VmMasterManualEditCommandResult,
  VmMasterPreviewResult,
} from "./types";
import { requestJson } from "../../lib/http";

export async function loadVmMasterPreview(): Promise<VmMasterPreviewResult> {
  return requestJson<VmMasterPreviewResult>(
    "/api/vm-master/preview",
    {},
    "VM master preview request",
  );
}

export async function executeVmMasterManualEditCommand(
  payload: VmMasterManualEditCommand,
): Promise<VmMasterManualEditCommandResult> {
  return requestJson<VmMasterManualEditCommandResult>(
    "/api/vm-master/commands/manual-edit",
    { method: "POST", body: payload },
    "VM master manual edit command",
  );
}

export async function loadHelpdeskVmSyncLogs(): Promise<HelpdeskVmSyncLogListResult> {
  return requestJson<HelpdeskVmSyncLogListResult>(
    "/api/vm-master/sync-logs",
    {},
    "Helpdesk sync log request",
  );
}

export async function loadHelpdeskVmSyncLog(
  id: string,
): Promise<HelpdeskVmSyncLogDetailResult> {
  return requestJson<HelpdeskVmSyncLogDetailResult>(
    `/api/vm-master/sync-logs/${encodeURIComponent(id)}`,
    {},
    "Helpdesk sync log detail request",
  );
}

export async function syncHelpdeskVmMaster(
  options: HelpdeskVmSyncOptions,
): Promise<HelpdeskVmSyncResult> {
  return requestJson<HelpdeskVmSyncResult>(
    "/api/vm-master/sync-helpdesk",
    { method: "POST", body: options },
    "Helpdesk sync request",
  );
}

export async function previewVmMasterExcelImport(payload: {
  fileName: string;
  workbookBase64: string;
}): Promise<VmMasterExcelPreviewResult> {
  return requestJson<VmMasterExcelPreviewResult>(
    "/api/vm-master/import-excel/preview",
    { method: "POST", body: payload },
    "VM Master Excel import preview",
  );
}

export async function executeVmMasterExcelImport(payload: {
  fileName: string;
  workbookBase64: string;
  mapping: VmMasterExcelImportMapping;
}): Promise<VmMasterExcelImportExecuteResult> {
  return requestJson<VmMasterExcelImportExecuteResult>(
    "/api/vm-master/import-excel/execute",
    { method: "POST", body: payload },
    "VM Master Excel import",
  );
}
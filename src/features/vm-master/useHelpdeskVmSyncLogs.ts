import { shallowRef } from "vue";
import {
  loadHelpdeskVmSyncLog as loadHelpdeskVmSyncLogApi,
  loadHelpdeskVmSyncLogs as loadHelpdeskVmSyncLogsApi,
} from "./api";
import type {
  HelpdeskVmSyncLogDetailResult,
  HelpdeskVmSyncLogEntry,
  HelpdeskVmSyncLogListItem,
  HelpdeskVmSyncLogListResult,
} from "./types";
import { useAsyncTask } from "./useAsyncTask";

type UseHelpdeskVmSyncLogsDeps = {
  listLogsApi?: () => Promise<HelpdeskVmSyncLogListResult>;
  loadLogApi?: (id: string) => Promise<HelpdeskVmSyncLogDetailResult>;
};

export function useHelpdeskVmSyncLogs(deps: UseHelpdeskVmSyncLogsDeps = {}) {
  const history = shallowRef<HelpdeskVmSyncLogListItem[]>([]);
  const selectedLog = shallowRef<HelpdeskVmSyncLogEntry | null>(null);
  const listLogsApi = deps.listLogsApi ?? loadHelpdeskVmSyncLogsApi;
  const loadLogApi = deps.loadLogApi ?? loadHelpdeskVmSyncLogApi;
  const task = useAsyncTask();

  async function selectLog(id: string): Promise<void> {
    const result = await task.run(() => loadLogApi(id), "Failed to load Helpdesk sync log");
    if (!result) {
      selectedLog.value = null;
      return;
    }

    if (!result.ok) {
      task.setError(result.error);
      selectedLog.value = null;
      return;
    }

    selectedLog.value = result.log;
  }

  async function loadHistory(): Promise<void> {
    const result = await task.run(listLogsApi, "Failed to load Helpdesk sync history");
    if (!result) {
      history.value = [];
      selectedLog.value = null;
      return;
    }

    if (!result.ok) {
      task.setError(result.error);
      history.value = [];
      selectedLog.value = null;
      return;
    }

    history.value = result.logs;
    if (result.logs.length > 0) {
      await selectLog(result.logs[0].id);
    } else {
      selectedLog.value = null;
    }
  }

  return {
    history,
    selectedLog,
    loading: task.loading,
    error: task.error,
    loadHistory,
    selectLog,
  };
}

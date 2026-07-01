import { readonly, shallowRef } from "vue";
import { syncHelpdeskVmMaster as syncHelpdeskVmMasterApi } from "./api";
import type {
  HelpdeskVmSyncOptions,
  HelpdeskVmSyncResult,
  HelpdeskVmSyncSummary,
} from "./types";
import { useAsyncTask } from "./useAsyncTask";

type UseHelpdeskVmSyncDeps = {
  refreshPreview: () => Promise<void>;
  syncApi?: (options: HelpdeskVmSyncOptions) => Promise<HelpdeskVmSyncResult>;
};

export function useHelpdeskVmSync(deps: UseHelpdeskVmSyncDeps) {
  const summary = shallowRef<HelpdeskVmSyncSummary | null>(null);
  const syncApi = deps.syncApi ?? syncHelpdeskVmMasterApi;
  const task = useAsyncTask();

  async function syncFromHelpdesk(options: HelpdeskVmSyncOptions = { count: 25 }): Promise<void> {
    summary.value = null;

    const result = await task.run(async () => {
      const nextResult = await syncApi(options);
      if (nextResult.ok) {
        await deps.refreshPreview();
      }
      return nextResult;
    }, "Failed to sync Helpdesk tickets");
    if (!result) {
      return;
    }

    if (!result.ok) {
      task.setError(result.error);
      return;
    }

    summary.value = result.summary;
  }

  return {
    syncing: task.loading,
    error: task.error,
    summary: readonly(summary),
    syncFromHelpdesk,
  };
}

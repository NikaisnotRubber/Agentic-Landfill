import { computed, onMounted, readonly, shallowRef } from "vue";
import { executeVmMasterManualEditCommand, loadVmMasterPreview } from "./api";
import type {
  VmMasterBgGroup,
  VmMasterManualEditChange,
  VmMasterPreviewRow,
} from "./types";
import { useAsyncTask } from "./useAsyncTask";

type EditableVmMasterPreviewRow = VmMasterPreviewRow & {
  originalAdName: string;
  originalVmName: string;
};

type EditableVmMasterBgGroup = Omit<VmMasterBgGroup, "rows"> & {
  rows: EditableVmMasterPreviewRow[];
};

export type VmMasterDraftFieldUpdate = {
  originalAdName: string;
  originalVmName: string;
  field: keyof VmMasterPreviewRow;
  value: string | number | null;
};

const editableFields: Array<keyof VmMasterPreviewRow> = [
  "bg",
  "chnName",
  "emailAddress",
  "bu",
  "userRole",
  "userDept",
  "reportTo",
  "buCurr",
  "bgCurr",
  "groupName",
  "vmName",
  "maxOnlineUsers",
  "zenteraRole",
];

function rowKey(adName: string, vmName: string): string {
  return `${adName}\u0000${vmName}`;
}

function createDraftGroups(groups: VmMasterBgGroup[]): EditableVmMasterBgGroup[] {
  return groups.map((group) => ({
    ...group,
    rows: group.rows.map((row) => ({
      ...row,
      originalAdName: row.adName,
      originalVmName: row.vmName,
    })),
  }));
}

function stripDraftIdentity(row: EditableVmMasterPreviewRow): VmMasterPreviewRow {
  const { originalAdName: _originalAdName, originalVmName: _originalVmName, ...previewRow } = row;
  return previewRow;
}

function rowsDiffer(original: VmMasterPreviewRow, draft: VmMasterPreviewRow): boolean {
  return editableFields.some((field) => original[field] !== draft[field]);
}

export function useVmMasterPreview() {
  const groups = shallowRef<VmMasterBgGroup[]>([]);
  const draftGroups = shallowRef<EditableVmMasterBgGroup[]>([]);
  const editing = shallowRef(false);
  const commandMessage = shallowRef("");
  const task = useAsyncTask();
  const commandTask = useAsyncTask();

  const activeGroups = computed<VmMasterBgGroup[]>(() =>
    editing.value ? draftGroups.value : groups.value,
  );

  const rows = computed<VmMasterPreviewRow[]>(() =>
    activeGroups.value.flatMap((group) => group.rows.map((row) => ({ ...row, bg: group.bg }))),
  );

  const totals = computed(() => ({
    bgCount: activeGroups.value.length,
    assignmentCount: activeGroups.value.reduce((sum, group) => sum + group.assignmentCount, 0),
    userCount: activeGroups.value.reduce((sum, group) => sum + group.userCount, 0),
    vmCount: activeGroups.value.reduce((sum, group) => sum + group.vmCount, 0),
  }));

  const originalRowsByKey = computed(() => {
    const rowsByKey = new Map<string, VmMasterPreviewRow>();
    for (const group of groups.value) {
      for (const row of group.rows) {
        rowsByKey.set(rowKey(row.adName, row.vmName), row);
      }
    }
    return rowsByKey;
  });

  const dirtyChanges = computed<VmMasterManualEditChange[]>(() => {
    if (!editing.value) {
      return [];
    }

    return draftGroups.value.flatMap((group) =>
      group.rows.flatMap((row) => {
        const original = originalRowsByKey.value.get(rowKey(row.originalAdName, row.originalVmName));
        const draft = stripDraftIdentity(row);
        if (!original || !rowsDiffer(original, draft)) {
          return [];
        }

        return [
          {
            originalAdName: row.originalAdName,
            originalVmName: row.originalVmName,
            row: draft,
          },
        ];
      }),
    );
  });

  const dirtyCount = computed(() => dirtyChanges.value.length);

  async function loadPreview(): Promise<void> {
    const result = await task.run(loadVmMasterPreview, "Failed to load VM master preview");
    if (!result) {
      groups.value = [];
      draftGroups.value = [];
      editing.value = false;
      return;
    }

    if (result.ok) {
      groups.value = result.groups;
      draftGroups.value = [];
      editing.value = false;
    } else {
      groups.value = [];
      draftGroups.value = [];
      editing.value = false;
      task.setError(result.error);
    }
  }

  function startEditing(): void {
    draftGroups.value = createDraftGroups(groups.value);
    editing.value = true;
    commandMessage.value = "";
    commandTask.setError("");
  }

  function cancelEditing(): void {
    draftGroups.value = [];
    editing.value = false;
    commandMessage.value = "";
    commandTask.setError("");
  }

  function updateDraftField(update: VmMasterDraftFieldUpdate): void {
    if (!editing.value) {
      return;
    }

    draftGroups.value = draftGroups.value.map((group) => ({
      ...group,
      rows: group.rows.map((row) =>
        row.originalAdName === update.originalAdName && row.originalVmName === update.originalVmName
          ? { ...row, [update.field]: update.value }
          : row,
      ),
    }));
  }

  async function publishDraft(): Promise<void> {
    const changes = dirtyChanges.value;
    if (changes.length === 0) {
      return;
    }

    const result = await commandTask.run(
      () => executeVmMasterManualEditCommand({ changedBy: "manual-edit", changes }),
      "Failed to execute VM master manual edit command",
    );
    if (!result) {
      return;
    }

    if (result.ok) {
      commandMessage.value = `Published ${result.updatedCount} row(s). Command ${result.commandId.slice(0, 8)}.`;
      await loadPreview();
    } else {
      commandTask.setError(result.error);
    }
  }

  onMounted(() => {
    void loadPreview();
  });

  return {
    groups: readonly(activeGroups),
    rows,
    totals,
    loading: task.loading,
    error: task.error,
    editing: readonly(editing),
    dirtyCount,
    publishing: commandTask.loading,
    publishError: commandTask.error,
    commandMessage: readonly(commandMessage),
    loadPreview,
    startEditing,
    cancelEditing,
    updateDraftField,
    publishDraft,
  };
}
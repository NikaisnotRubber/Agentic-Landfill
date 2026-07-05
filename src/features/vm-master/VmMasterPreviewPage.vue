<script setup lang="ts">
import { computed, ref } from "vue";
import { getDisabledImportFields, updateImportMapping } from "./excelImportMapping";
import type { VmMasterExcelImportField, VmMasterExecutionWarning } from "./types";
import VmMasterTable from "./VmMasterTable.vue";
import { useHelpdeskVmSync } from "./useHelpdeskVmSync";
import { useHelpdeskVmSyncLogs } from "./useHelpdeskVmSyncLogs";
import { useVmMasterExcelImport } from "./useVmMasterExcelImport";
import { useVmMasterPreview } from "./useVmMasterPreview";

const {
  groups,
  totals,
  loading,
  error,
  editing,
  dirtyCount,
  publishing,
  publishError,
  commandMessage,
  loadPreview,
  startEditing,
  cancelEditing,
  updateDraftField,
  publishDraft,
} = useVmMasterPreview();
const {
  syncing,
  error: syncError,
  summary: syncSummary,
  syncFromHelpdesk,
} = useHelpdeskVmSync({ refreshPreview: loadPreview });
const {
  history: syncLogHistory,
  selectedLog,
  loading: syncLogsLoading,
  error: syncLogsError,
  loadHistory,
  selectLog,
} = useHelpdeskVmSyncLogs();
const fileInput = ref<HTMLInputElement | null>(null);
const {
  loading: importingExcel,
  error: importError,
  preview: excelPreview,
  mapping: excelMapping,
  summary: excelImportSummary,
  showOverlay: showExcelImportOverlay,
  previewFile,
  closeOverlay: closeExcelImportOverlay,
  executeImport: executeExcelImport,
} = useVmMasterExcelImport({ refreshPreview: loadPreview });
const showSyncHistory = ref(false);
const copyStatus = ref("");

const historyHealthText = computed(() => {
  if (syncLogHistory.value.length === 0) {
    return "No execution history";
  }

  const failureCount = syncLogHistory.value.filter((entry) => !entry.ok).length;
  if (failureCount === 0) {
    return `No failures in the last ${syncLogHistory.value.length} execution(s)`;
  }

  return `${failureCount} failure(s) in the last ${syncLogHistory.value.length} execution(s)`;
});

const selectedLogText = computed(() => selectedLog.value?.logs.join("\n") ?? "");

const excelWorksheetLabel = computed(() => {
  const preview = excelPreview.value;
  if (!preview) {
    return "";
  }
  if (preview.worksheets.length <= 1) {
    return preview.worksheetName;
  }
  return (
    String(preview.worksheets.length) +
    " sheets: " +
    preview.worksheets.map((worksheet) => worksheet.worksheetName).join(", ")
  );
});

function formatExecutionTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(value));
}

type ExecutionSummaryRow = [string, string | number];

function executionKindLabel(kind: string | undefined): string {
  return kind === "excel-import" ? "Excel import" : "Sync Helpdesk";
}

function selectedExecutionSummaryRows(): ExecutionSummaryRow[] {
  if (!selectedLog.value) {
    return [];
  }

  if (selectedLog.value.kind === "excel-import") {
    const summary = selectedLog.value.summary;
    return [
      ["Rows imported", summary.importedRowCount],
      ["Rows failed", summary.failedRowCount],
      ["AD enriched", summary.adEnrichedCount],
      ["Warnings", selectedLog.value.warnings.length],
      ["Status", selectedLog.value.ok ? "Success" : "Failed"],
    ];
  }

  const summary = selectedLog.value.summary;
  return [
    ["Users synced", summary.userUpsertedCount],
    ["Assignments inserted", summary.assignmentInsertedCount],
    ["Warnings", selectedLog.value.warnings.length],
    ["Status", selectedLog.value.ok ? "Success" : "Failed"],
  ];
}

function executionWarningKey(warning: VmMasterExecutionWarning, index: number): string {
  if ("ticketId" in warning) {
    return `${warning.ticketId}-${warning.code}-${index}`;
  }
  return `${warning.rowNumber}-${warning.code}-${index}`;
}

function executionWarningSubject(warning: VmMasterExecutionWarning): string {
  if ("ticketId" in warning) {
    return `Ticket ${warning.ticketId}${warning.adName ? ` / ${warning.adName}` : ""}`;
  }
  return `Excel row ${warning.rowNumber}${warning.adName ? ` / ${warning.adName}` : ""}`;
}

function formatRequestSummary(summary: unknown): string {
  return JSON.stringify(summary, null, 2);
}

async function runHelpdeskSync(): Promise<void> {
  await syncFromHelpdesk();
  if (showSyncHistory.value) {
    await loadHistory();
  }
}

async function openSyncHistory(): Promise<void> {
  showSyncHistory.value = true;
  await loadHistory();
}

function openExcelImportPicker(): void {
  fileInput.value?.click();
}

async function handleExcelFileChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) {
    return;
  }

  await previewFile(file);
}

function changeExcelMapping(header: string, event: Event): void {
  const select = event.target as HTMLSelectElement;
  excelMapping.value = updateImportMapping(
    excelMapping.value,
    header,
    select.value as VmMasterExcelImportField | "",
  );
}

function isImportFieldDisabled(header: string, field: VmMasterExcelImportField): boolean {
  return getDisabledImportFields(excelMapping.value, header).has(field);
}

async function runExcelImport(): Promise<void> {
  await executeExcelImport();
  if (showSyncHistory.value) {
    await loadHistory();
  }
}

async function copyLogs(): Promise<void> {
  if (!selectedLogText.value) {
    return;
  }

  await navigator.clipboard.writeText(selectedLogText.value);
  copyStatus.value = "Copied";
  window.setTimeout(() => {
    copyStatus.value = "";
  }, 1600);
}
</script>

<template>
  <main class="page-shell">
    <section class="page-header">
      <div>
        <p class="eyebrow">VM Master</p>
        <h1>VM Master Preview</h1>
        <p class="lede">Browse the SQLite-maintained AD to VM relationship grouped by BG.</p>
      </div>
      <div class="page-header-actions">
        <input
          ref="fileInput"
          class="visually-hidden"
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          @change="handleExcelFileChange"
        />
        <button
          type="button"
          class="secondary-action"
          :disabled="loading || syncing || importingExcel"
          @click="openExcelImportPicker"
        >
          {{ importingExcel ? "Importing" : "Import Excel" }}
        </button>
        <button
          type="button"
          class="secondary-action"
          :disabled="loading || syncing || importingExcel"
          @click="runHelpdeskSync()"
        >
          {{ syncing ? "Syncing" : "Sync Helpdesk" }}
        </button>
        <button
          type="button"
          class="secondary-action"
          :disabled="syncLogsLoading"
          @click="openSyncHistory"
        >
          {{ syncLogsLoading ? "Loading history" : "Execution history" }}
        </button>
        <button
          v-if="!editing"
          type="button"
          class="secondary-action"
          :disabled="loading || syncing || groups.length === 0"
          @click="startEditing"
        >
          Edit
        </button>
        <button
          v-if="editing"
          type="button"
          class="secondary-action"
          :disabled="publishing"
          @click="cancelEditing"
        >
          Cancel
        </button>
        <button
          v-if="editing"
          type="button"
          class="primary-action"
          :disabled="dirtyCount === 0 || publishing"
          @click="publishDraft"
        >
          {{ publishing ? "Publishing" : `Publish (${dirtyCount})` }}
        </button>
        <button type="button" class="primary-action" :disabled="loading || publishing" @click="loadPreview">
          {{ loading ? "Loading" : "Refresh" }}
        </button>
      </div>
    </section>

    <section class="summary-grid" aria-label="VM master summary">
      <div class="summary-item">
        <span>BG</span>
        <strong>{{ totals.bgCount }}</strong>
      </div>
      <div class="summary-item">
        <span>Assignments</span>
        <strong>{{ totals.assignmentCount }}</strong>
      </div>
      <div class="summary-item">
        <span>Users</span>
        <strong>{{ totals.userCount }}</strong>
      </div>
      <div class="summary-item">
        <span>VMs</span>
        <strong>{{ totals.vmCount }}</strong>
      </div>
    </section>

    <section v-if="error" class="status-message error">
      {{ error }}
    </section>

    <section v-if="syncError" class="status-message error">
      {{ syncError }}
    </section>
    <section v-if="importError" class="status-message error">
      {{ importError }}
    </section>
    <section v-if="publishError" class="status-message error">
      {{ publishError }}
    </section>

    <section v-if="commandMessage" class="status-message success">
      {{ commandMessage }}
    </section>

    <section v-if="editing" class="status-message neutral">
      Editing {{ dirtyCount }} changed row(s). Publish executes a VM Master manual edit command.
    </section>

    <section v-if="syncSummary" class="status-message success">
      <span>
        Synced {{ syncSummary.userUpsertedCount }} users /         {{ syncSummary.assignmentInsertedCount }} assignments inserted /         {{ syncSummary.warnings.length }} warnings
      </span>
      <button type="button" class="inline-link-button" @click="openSyncHistory">
        View execution history
      </button>
    </section>

    <section v-if="excelImportSummary" class="status-message success">
      <span>
        Imported {{ excelImportSummary.importedRowCount }} of {{ excelImportSummary.rowCount }} Excel row(s) /
        {{ excelImportSummary.failedRowCount }} failed /
        {{ excelImportSummary.warnings.length }} warnings
      </span>
      <button type="button" class="inline-link-button" @click="openSyncHistory">
        View execution history
      </button>
    </section>
    <section v-if="showSyncHistory" class="sync-history-panel" aria-label="VM Master execution history">
      <div class="sync-history-status">
        <span
          class="sync-history-status-icon"
          :class="{ failed: syncLogHistory.some((entry) => !entry.ok) }"
          aria-hidden="true"
        >
          {{ syncLogHistory.some((entry) => !entry.ok) ? "!" : "OK" }}
        </span>
        <strong>{{ historyHealthText }}</strong>
      </div>

      <div v-if="syncLogsError" class="status-message error">
        {{ syncLogsError }}
      </div>

      <div v-if="syncLogHistory.length > 0" class="execution-history">
        <h2>VM Master execution history</h2>
        <div class="execution-dots" aria-label="Execution runs">
          <button
            v-for="entry in syncLogHistory"
            :key="entry.id"
            type="button"
            class="execution-dot"
            :class="{
              selected: selectedLog?.id === entry.id,
              failed: !entry.ok,
              warned: entry.ok && entry.warningCount > 0,
            }"
            :title="`${executionKindLabel(entry.kind)} / ${formatExecutionTime(entry.finishedAt)} / ${entry.warningCount} warning(s)`"
            @click="selectLog(entry.id)"
          >
            {{ entry.ok ? (entry.warningCount > 0 ? "!" : "OK") : "?" }}
          </button>
        </div>

        <div v-if="selectedLog" class="execution-detail">
          <section class="execution-detail-section">
            <h3>Time</h3>
            <p class="subtle">The time this was executed (server timezone).</p>
            <p>{{ formatExecutionTime(selectedLog.finishedAt) }}</p>
          </section>

          <section v-if="selectedLog.requestSummary" class="execution-detail-section">
            <h3>Request</h3>
            <pre class="log-output">{{ formatRequestSummary(selectedLog.requestSummary) }}</pre>
          </section>

          <section class="execution-detail-section">
            <h3>Summary</h3>
            <div class="execution-summary-grid">
              <template v-for="[label, value] in selectedExecutionSummaryRows()" :key="label">
                <span>{{ label }}</span>
                <strong>{{ value }}</strong>
              </template>
            </div>
          </section>

          <section v-if="selectedLog.warnings.length > 0" class="execution-detail-section">
            <h3>Warnings</h3>
            <div class="warning-list">
              <article
                v-for="(warning, index) in selectedLog.warnings"
                :key="executionWarningKey(warning, index)"
              >
                <div>
                  <strong>{{ warning.code }}</strong>
                  <span>{{ warning.stage }}</span>
                </div>
                <p>{{ warning.message }}</p>
                <p v-if="warning.detail" class="subtle">{{ warning.detail }}</p>
                <p class="subtle">{{ executionWarningSubject(warning) }}</p>
              </article>
            </div>
          </section>

          <section class="execution-detail-section">
            <div class="execution-section-header">
              <h3>Logs</h3>
              <button type="button" class="inline-link-button" @click="copyLogs">
                {{ copyStatus || "Copy Logs" }}
              </button>
            </div>
            <pre class="log-output">{{ selectedLogText }}</pre>
          </section>
        </div>
      </div>
    </section>

    <div v-if="showExcelImportOverlay && excelPreview" class="overlay-backdrop" role="presentation">
      <section class="mapping-card" role="dialog" aria-modal="true" aria-label="Map Excel columns">
        <header class="mapping-card-header">
          <div>
            <h2>Map Excel columns</h2>
            <p class="subtle">
              {{ excelPreview.fileName }} / {{ excelWorksheetLabel }} /
              {{ excelPreview.rowCount }} rows
            </p>
          </div>
          <button type="button" class="secondary-action" :disabled="importingExcel" @click="closeExcelImportOverlay">
            Cancel
          </button>
        </header>

        <div class="mapping-table-frame">
          <table class="mapping-table">
            <thead>
              <tr>
                <th>Excel column</th>
                <th>DB field</th>
                <th>Sample</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="header in excelPreview.headers" :key="header">
                <td>{{ header }}</td>
                <td>
                  <select
                    class="mapping-select"
                    :value="excelMapping[header] ?? ''"
                    @change="changeExcelMapping(header, $event)"
                  >
                    <option value="">Skip</option>
                    <option
                      v-for="field in excelPreview.importableFields"
                      :key="field"
                      :value="field"
                      :disabled="isImportFieldDisabled(header, field)"
                    >
                      {{ field }}
                    </option>
                  </select>
                </td>
                <td>
                  <span class="subtle">
                    {{ excelPreview.sampleRows[0]?.values[header] ?? "" }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <footer class="mapping-card-actions">
          <button type="button" class="secondary-action" :disabled="importingExcel" @click="closeExcelImportOverlay">
            Cancel
          </button>
          <button type="button" class="primary-action" :disabled="importingExcel" @click="runExcelImport">
            {{ importingExcel ? "Importing" : "Import" }}
          </button>
        </footer>
      </section>
    </div>
    <VmMasterTable :groups="groups" :editing="editing" @update-field="updateDraftField" />
  </main>
</template>

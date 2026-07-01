<script setup lang="ts">
import { computed, ref } from "vue";
import VmMasterTable from "./VmMasterTable.vue";
import { useHelpdeskVmSync } from "./useHelpdeskVmSync";
import { useHelpdeskVmSyncLogs } from "./useHelpdeskVmSyncLogs";
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

function formatExecutionTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(value));
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
        <button
          type="button"
          class="secondary-action"
          :disabled="loading || syncing"
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

    <section v-if="showSyncHistory" class="sync-history-panel" aria-label="Helpdesk sync history">
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
        <h2>'Sync Helpdesk' execution history</h2>
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
            :title="`${formatExecutionTime(entry.finishedAt)} / ${entry.warningCount} warning(s)`"
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

          <section class="execution-detail-section">
            <h3>Summary</h3>
            <div class="execution-summary-grid">
              <span>Users synced</span>
              <strong>{{ selectedLog.summary.userUpsertedCount }}</strong>
              <span>Assignments inserted</span>
              <strong>{{ selectedLog.summary.assignmentInsertedCount }}</strong>
              <span>Warnings</span>
              <strong>{{ selectedLog.warnings.length }}</strong>
              <span>Status</span>
              <strong>{{ selectedLog.ok ? "Success" : "Failed" }}</strong>
            </div>
          </section>

          <section v-if="selectedLog.warnings.length > 0" class="execution-detail-section">
            <h3>Warnings</h3>
            <div class="warning-list">
              <article v-for="warning in selectedLog.warnings" :key="`${warning.ticketId}-${warning.code}`">
                <div>
                  <strong>{{ warning.code }}</strong>
                  <span>{{ warning.stage }}</span>
                </div>
                <p>{{ warning.message }}</p>
                <p v-if="warning.detail" class="subtle">{{ warning.detail }}</p>
                <p class="subtle">
                  Ticket {{ warning.ticketId }}
                  <span v-if="warning.adName"> / {{ warning.adName }}</span>
                </p>
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

    <VmMasterTable :groups="groups" :editing="editing" @update-field="updateDraftField" />
  </main>
</template>

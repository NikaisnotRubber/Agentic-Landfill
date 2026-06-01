<script setup lang="ts">
import { computed, ref, shallowRef } from "vue";

import {
  enrichCurrentTickets,
  fetchAndEnrichLiveTickets,
  loadLiveTickets,
  loadSampleTickets,
} from "./lib/api";
import {
  canEnrichCurrentTickets,
  canFetchAndEnrichTickets,
  canShowProcessedView,
  mergeAdIntoProcessedRows,
} from "./lib/adEnrichment";
import { getTicketStatusTone } from "../server/ddp/statusColors";
import type { TicketFetchFailure, TicketFetchSuccess } from "./lib/types";

function getStatusCellClass(status: string): string {
  return `status-cell-${getTicketStatusTone(status)}`;
}

const count = ref(25);
const technician = ref("");
const stateFile = ref("IT工單(不可用，僅供參考)/delta_sso_state.json");
const filterText = ref("");
const loading = ref(false);
const enriching = ref(false);
const result = shallowRef<TicketFetchSuccess | null>(null);
const failure = shallowRef<TicketFetchFailure | null>(null);
const rawExpanded = ref(false);
const activeView = ref<"raw" | "processed">("raw");

const visibleTickets = computed(() => {
  const tickets = result.value?.tickets ?? [];
  const keyword = filterText.value.trim().toLowerCase();
  if (!keyword) {
    return tickets;
  }

  return tickets.filter((ticket) => {
    const searchableValues = [
      ticket.id,
      ticket.subject,
      ticket.requester,
      ticket.technician,
      ticket.status,
      ticket.created_time,
      ticket.site,
      ticket.category,
      ticket.group,
      ticket.short_description,
      ticket.ad?.adAccount ?? "",
      ticket.ad?.displayName ?? "",
      ticket.ad?.mail ?? "",
      ticket.ad?.department ?? "",
      ticket.ad?.manager ?? "",
      ticket.ad?.employeeId ?? "",
      ticket.ad?.bg ?? "",
      ticket.ad?.bu ?? "",
      ticket.ad?.status ?? "",
      ticket.ad?.error ?? "",
    ];

    return searchableValues.some((value) => value.toLowerCase().includes(keyword));
  });
});

const statusCounts = computed(() => {
  const counts = new Map<string, number>();
  for (const ticket of result.value?.tickets ?? []) {
    counts.set(ticket.status, (counts.get(ticket.status) ?? 0) + 1);
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1]);
});

const canEnrich = computed(() =>
  canEnrichCurrentTickets(result.value, loading.value, enriching.value),
);
const canFetchAndEnrich = computed(() =>
  canFetchAndEnrichTickets(loading.value, enriching.value),
);

const processedRows = computed(() => result.value?.processedRows ?? []);

const canShowProcessed = computed(() => canShowProcessedView(processedRows.value));

const visibleProcessedRows = computed(() => {
  const rows = processedRows.value;
  const keyword = filterText.value.trim().toLowerCase();
  if (!keyword) {
    return rows;
  }

  return rows.filter((row) => {
    const searchableValues = [
      row.ticketId,
      row.subject,
      row.requester,
      row.status,
      row.adAccount,
      row.adName,
      row.firstName,
      row.lastName,
      row.mail,
      row.bu,
      row.nbHostname,
      row.vmHostname,
      row.abnormalFlags.join(" "),
    ];

    return searchableValues.some((value) => value.toLowerCase().includes(keyword));
  });
});

function formatAbnormalFlags(flags: string[]): string {
  return flags.length > 0 ? flags.join(", ") : "-";
}

function resetViewAfterFetch() {
  activeView.value = "raw";
}

async function runSampleFetch() {
  loading.value = true;
  failure.value = null;
  try {
    const next = await loadSampleTickets();
    if (next.ok) {
      result.value = next;
      resetViewAfterFetch();
    } else {
      result.value = null;
      failure.value = next;
    }
  } finally {
    loading.value = false;
  }
}

async function runLiveFetch() {
  loading.value = true;
  failure.value = null;
  try {
    const next = await loadLiveTickets({
      count: count.value,
      technician: technician.value || undefined,
      stateFile: stateFile.value || undefined,
    });
    if (next.ok) {
      result.value = next;
      resetViewAfterFetch();
    } else {
      result.value = null;
      failure.value = next;
    }
  } finally {
    loading.value = false;
  }
}

async function runFetchAndEnrich() {
  loading.value = true;
  failure.value = null;
  try {
    const next = await fetchAndEnrichLiveTickets({
      count: count.value,
      technician: technician.value || undefined,
      stateFile: stateFile.value || undefined,
    });
    if (next.ok) {
      result.value = next;
      resetViewAfterFetch();
    } else {
      result.value = null;
      failure.value = next;
    }
  } finally {
    loading.value = false;
  }
}

async function runAdEnrichment() {
  if (!result.value) {
    return;
  }

  enriching.value = true;
  failure.value = null;

  try {
    const current = result.value;
    const next = await enrichCurrentTickets({
      source: current.source,
      tickets: current.tickets,
    });

    if (next.ok) {
      result.value = {
        ...next,
        raw: current.raw,
        processedRows: current.processedRows
          ? mergeAdIntoProcessedRows(next.tickets, current.processedRows)
          : current.processedRows,
        processedSummary: current.processedSummary,
      };
    } else {
      failure.value = next;
    }
  } finally {
    enriching.value = false;
  }
}
</script>

<template>
  <main class="page-shell">
    <section class="hero-band">
      <div class="hero-copy">
        <p class="eyebrow">Local operator console</p>
        <h1>Helpdesk Ticket Preview</h1>
        <p class="lede">
          Fetch ticket rows through the current Helpdesk browser session and inspect the
          cleaned payload before any downstream processing.
        </p>
      </div>
      <div class="control-strip">
        <label>
          <span>Row count</span>
          <input v-model.number="count" type="number" min="1" max="200" />
        </label>
        <label>
          <span>Technician</span>
          <input v-model="technician" type="text" placeholder="Optional exact match" />
        </label>
        <label class="wide">
          <span>State file</span>
          <input v-model="stateFile" type="text" />
        </label>
        <div class="actions">
          <button
            type="button"
            class="primary"
            :disabled="loading || enriching"
            @click="runLiveFetch"
          >
            {{ loading ? "Fetching..." : "Fetch Live" }}
          </button>
          <button
            type="button"
            class="primary"
            :disabled="!canFetchAndEnrich"
            @click="runFetchAndEnrich"
          >
            {{ loading ? "Fetching..." : "Fetch + Enrich" }}
          </button>
          <button
            type="button"
            class="secondary"
            :disabled="loading || enriching"
            @click="runSampleFetch"
          >
            Load Sample
          </button>
          <button
            type="button"
            class="secondary"
            :disabled="!canEnrich"
            @click="runAdEnrichment"
          >
            {{ enriching ? "Enriching..." : "Enrich Current Tickets" }}
          </button>
        </div>
      </div>
    </section>

    <section v-if="failure" class="status-band error">
      <strong>Fetch failed.</strong>
      <span>{{ failure.error }}</span>
    </section>

    <section v-if="result?.adWarning" class="status-band warning">
      <strong>AD enrichment incomplete.</strong>
      <span>{{ result.adWarning }}</span>
    </section>

    <section v-if="result?.processedSummary?.trackerWarning" class="status-band warning">
      <strong>New-ticket tracker warning.</strong>
      <span>{{ result.processedSummary.trackerWarning }}</span>
    </section>

    <section v-if="result" class="metrics-band">
      <div class="metric">
        <span class="metric-label">Source</span>
        <strong>{{ result.source }}</strong>
      </div>
      <div class="metric">
        <span class="metric-label">Rows</span>
        <strong>{{ result.count }}</strong>
      </div>
      <div class="metric">
        <span class="metric-label">Visible</span>
        <strong>{{ visibleTickets.length }}</strong>
      </div>
      <div class="metric wide">
        <span class="metric-label">Statuses</span>
        <strong>{{ statusCounts.map(([name, value]) => `${name} ${value}`).join(" · ") }}</strong>
      </div>
      <div v-if="result.adSummary" class="metric wide">
        <span class="metric-label">AD Summary</span>
        <strong>
          {{
            [
              `Enriched ${result.adSummary.enrichedCount}`,
              `Unique ${result.adSummary.uniqueAccounts}`,
              `Missing requester ${result.adSummary.missingRequesterCount}`,
              `Not found ${result.adSummary.notFoundCount}`,
              `Lookup failed ${result.adSummary.lookupFailedCount}`,
            ].join(" · ")
          }}
        </strong>
      </div>
      <div v-if="result.processedSummary" class="metric">
        <span class="metric-label">New Tickets</span>
        <strong>{{ result.processedSummary.newTicketCount }}</strong>
      </div>
      <div v-if="result.processedSummary" class="metric">
        <span class="metric-label">Abnormal Rows</span>
        <strong>{{ result.processedSummary.abnormalRowCount }}</strong>
      </div>
    </section>

    <section v-if="result" class="table-band">
      <div class="view-toggle">
        <button
          type="button"
          :class="{ active: activeView === 'raw' }"
          @click="activeView = 'raw'"
        >
          Raw Tickets
        </button>
        <button
          type="button"
          :class="{ active: activeView === 'processed' }"
          :disabled="!canShowProcessed"
          @click="activeView = 'processed'"
        >
          Processed DDP View
        </button>
      </div>

      <div class="toolbar">
        <input
          v-model="filterText"
          class="search-input"
          type="search"
          placeholder="Filter subject, requester, technician, status, site, AD fields..."
        />
        <button
          type="button"
          class="secondary"
          :disabled="!canEnrich"
          @click="runAdEnrichment"
        >
          {{ enriching ? "Enriching..." : "Enrich Current Tickets" }}
        </button>
        <button type="button" class="secondary" @click="rawExpanded = !rawExpanded">
          {{ rawExpanded ? "Hide Raw JSON" : "Show Raw JSON" }}
        </button>
      </div>

      <div v-if="activeView === 'raw'" class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Subject</th>
              <th>Requester</th>
              <th>Technician</th>
              <th>Status</th>
              <th>Created</th>
              <th>Site</th>
              <th>Category</th>
              <th>AD Account</th>
              <th>AD Name</th>
              <th>Manager</th>
              <th>BU / BG</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="ticket in visibleTickets" :key="ticket.id">
              <td>{{ ticket.id }}</td>
              <td class="subject-cell">
                <strong>{{ ticket.subject }}</strong>
                <p>{{ ticket.short_description }}</p>
              </td>
              <td>{{ ticket.requester }}</td>
              <td>{{ ticket.technician }}</td>
              <td :class="getStatusCellClass(ticket.status)">{{ ticket.status }}</td>
              <td>{{ ticket.created_time }}</td>
              <td>{{ ticket.site }}</td>
              <td>{{ ticket.category }}</td>
              <td>{{ ticket.ad?.adAccount ?? "-" }}</td>
              <td>
                <strong>{{ ticket.ad?.displayName ?? "-" }}</strong>
                <p v-if="ticket.ad?.status && ticket.ad.status !== 'enriched'">
                  {{ ticket.ad.status }}<span v-if="ticket.ad.error"> · {{ ticket.ad.error }}</span>
                </p>
              </td>
              <td>{{ ticket.ad?.manager ?? "-" }}</td>
              <td>{{ [ticket.ad?.bu, ticket.ad?.bg].filter(Boolean).join(" / ") || "-" }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else class="table-wrap processed-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Ticket ID</th>
              <th>Status</th>
              <th>New</th>
              <th>AD Account</th>
              <th>AD Name</th>
              <th>First Name</th>
              <th>Last Name</th>
              <th>Mail</th>
              <th>BU</th>
              <th>NB Hostname</th>
              <th>VM Hostname</th>
              <th>Abnormal Flags</th>
              <th>Subject</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in visibleProcessedRows" :key="row.ticketId">
              <td>{{ row.ticketId }}</td>
              <td :class="getStatusCellClass(row.status)">{{ row.status }}</td>
              <td>
                <span v-if="row.isNewTicket" class="new-ticket-pill">New</span>
                <span v-else>-</span>
              </td>
              <td>{{ row.adAccount || "-" }}</td>
              <td>{{ row.adName || "-" }}</td>
              <td>{{ row.firstName || "-" }}</td>
              <td>{{ row.lastName || "-" }}</td>
              <td>{{ row.mail || "-" }}</td>
              <td>{{ row.bu || "-" }}</td>
              <td>{{ row.nbHostname || "-" }}</td>
              <td>{{ row.vmHostname || "-" }}</td>
              <td>
                <span v-if="row.abnormalFlags.length" class="flag-list">
                  {{ formatAbnormalFlags(row.abnormalFlags) }}
                </span>
                <span v-else>-</span>
              </td>
              <td class="subject-cell">
                <strong>{{ row.subject }}</strong>
                <p>{{ row.requester }}</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <pre v-if="rawExpanded" class="raw-json">{{ JSON.stringify(result.raw, null, 2) }}</pre>
    </section>
  </main>
</template>

<script setup lang="ts">
import {
  FlexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useVueTable,
  type ExpandedState,
  type SortingState,
} from "@tanstack/vue-table";
import { computed, shallowRef, watch } from "vue";
import { getVmMasterSearchText, vmMasterColumns } from "./tableColumns";
import type { VmMasterBgGroup, VmMasterPreviewRow } from "./types";
import type { VmMasterDraftFieldUpdate } from "./useVmMasterPreview";

type EditableIdentity = {
  originalAdName?: string;
  originalVmName?: string;
};

type VmMasterTableRow = VmMasterPreviewRow &
  EditableIdentity & {
    rowKind: "group" | "detail";
    assignmentCount?: number;
    userCount?: number;
    vmCount?: number;
    subRows?: VmMasterTableRow[];
  };

const props = defineProps<{
  groups: VmMasterBgGroup[];
  editing: boolean;
}>();

const emit = defineEmits<{
  updateField: [update: VmMasterDraftFieldUpdate];
}>();

const editableColumns = new Set<keyof VmMasterPreviewRow>([
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
]);

const sorting = shallowRef<SortingState>([]);
const expanded = shallowRef<ExpandedState>({});
const globalFilter = shallowRef("");

function createEmptyGroupRow(group: VmMasterBgGroup): VmMasterTableRow {
  return {
    rowKind: "group",
    bg: group.bg,
    adName: "",
    chnName: "",
    emailAddress: "",
    bu: "",
    userRole: "",
    userDept: "",
    reportTo: "",
    buCurr: "",
    bgCurr: "",
    groupName: "",
    vmName: "",
    maxOnlineUsers: null,
    zenteraRole: "",
    assignmentCount: group.assignmentCount,
    userCount: group.userCount,
    vmCount: group.vmCount,
    subRows: group.rows.map((row) => ({ ...row, rowKind: "detail" })),
  };
}

const tableRows = computed<VmMasterTableRow[]>(() => props.groups.map(createEmptyGroupRow));

watch(
  () => props.groups.map((group) => group.bg).join("\u0000"),
  () => {
    expanded.value = Object.fromEntries(props.groups.map((group) => [`bg:${group.bg}`, true]));
  },
  { immediate: true },
);

const table = useVueTable({
  get data() {
    return tableRows.value;
  },
  columns: vmMasterColumns,
  state: {
    get sorting() {
      return sorting.value;
    },
    get expanded() {
      return expanded.value;
    },
    get globalFilter() {
      return globalFilter.value;
    },
  },
  globalFilterFn: (row, _columnId, value) =>
    getVmMasterSearchText(row.original).toLowerCase().includes(String(value).toLowerCase()),
  filterFromLeafRows: true,
  onSortingChange: (updater) => {
    sorting.value = typeof updater === "function" ? updater(sorting.value) : updater;
  },
  onExpandedChange: (updater) => {
    expanded.value = typeof updater === "function" ? updater(expanded.value) : updater;
  },
  getRowId: (row, index, parent) => {
    if (row.rowKind === "group") {
      return `bg:${row.bg}`;
    }

    return `${parent?.id ?? "row"}:${row.adName}:${row.vmName}:${index}`;
  },
  getSubRows: (row) => row.subRows,
  getRowCanExpand: (row) => row.original.rowKind === "group",
  onGlobalFilterChange: (updater) => {
    globalFilter.value = typeof updater === "function" ? updater(globalFilter.value) : updater;
  },
  getCoreRowModel: getCoreRowModel(),
  getExpandedRowModel: getExpandedRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
});

function isEditableCell(row: VmMasterTableRow, columnId: string): columnId is keyof VmMasterPreviewRow {
  return props.editing && row.rowKind === "detail" && editableColumns.has(columnId as keyof VmMasterPreviewRow);
}

function emitTextUpdate(row: VmMasterTableRow, field: keyof VmMasterPreviewRow, event: Event): void {
  const input = event.target as HTMLInputElement;
  emit("updateField", {
    originalAdName: row.originalAdName ?? row.adName,
    originalVmName: row.originalVmName ?? row.vmName,
    field,
    value: input.value,
  });
}

function emitNumberUpdate(row: VmMasterTableRow, field: keyof VmMasterPreviewRow, event: Event): void {
  const input = event.target as HTMLInputElement;
  emit("updateField", {
    originalAdName: row.originalAdName ?? row.adName,
    originalVmName: row.originalVmName ?? row.vmName,
    field,
    value: input.value === "" ? null : Number(input.value),
  });
}
</script>

<template>
  <section class="table-section" aria-label="VM master preview">
    <div class="table-toolbar">
      <label class="search-field">
        <span>Search</span>
        <input v-model="globalFilter" type="search" placeholder="AD, VM, group, role, department" />
      </label>
      <div class="table-count">{{ table.getRowModel().rows.length }} visible rows</div>
    </div>

    <div class="table-frame">
      <table class="vm-table">
        <thead>
          <tr v-for="headerGroup in table.getHeaderGroups()" :key="headerGroup.id">
            <th v-for="header in headerGroup.headers" :key="header.id" :colspan="header.colSpan">
              <button
                v-if="!header.isPlaceholder"
                type="button"
                class="header-button"
                :disabled="!header.column.getCanSort()"
                @click="header.column.getToggleSortingHandler()?.($event)"
              >
                <FlexRender :render="header.column.columnDef.header" :props="header.getContext()" />
                <span v-if="header.column.getIsSorted() === 'asc'">Asc</span>
                <span v-else-if="header.column.getIsSorted() === 'desc'">Desc</span>
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="table.getRowModel().rows.length === 0">
            <td class="empty-cell" :colspan="vmMasterColumns.length">
              No VM master rows match the current filter.
            </td>
          </tr>
          <tr
            v-for="row in table.getRowModel().rows"
            :key="row.id"
            :class="{ 'group-row': row.original.rowKind === 'group' }"
          >
            <td v-for="cell in row.getVisibleCells()" :key="cell.id">
              <template v-if="cell.column.id === 'bg' && row.getCanExpand()">
                <span class="group-cell">
                  <button
                    type="button"
                    class="group-toggle"
                    :aria-label="row.getIsExpanded() ? `Collapse ${cell.getValue()}` : `Expand ${cell.getValue()}`"
                    @click="row.toggleExpanded()"
                  >
                    {{ row.getIsExpanded() ? "-" : "+" }}
                  </button>
                  <strong>{{ cell.getValue() }}</strong>
                  <span class="subtle">
                    ({{ row.original.assignmentCount }} assignments /
                    {{ row.original.userCount }} users / {{ row.original.vmCount }} VMs)
                  </span>
                </span>
              </template>
              <template v-else-if="row.original.rowKind === 'group'">
                <span class="subtle">-</span>
              </template>
              <template v-else-if="isEditableCell(row.original, cell.column.id)">
                <input
                  v-if="cell.column.id === 'maxOnlineUsers'"
                  class="table-edit-input compact"
                  type="number"
                  min="0"
                  :value="row.original.maxOnlineUsers ?? ''"
                  @input="emitNumberUpdate(row.original, 'maxOnlineUsers', $event)"
                />
                <input
                  v-else
                  class="table-edit-input"
                  type="text"
                  :value="cell.getValue() as string"
                  @input="emitTextUpdate(row.original, cell.column.id as keyof VmMasterPreviewRow, $event)"
                />
              </template>
              <template v-else-if="cell.getIsAggregated()">
                <FlexRender
                  :render="cell.column.columnDef.aggregatedCell ?? cell.column.columnDef.cell"
                  :props="cell.getContext()"
                />
              </template>
              <template v-else-if="cell.getIsPlaceholder()">
                <span class="subtle">-</span>
              </template>
              <template v-else>
                <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
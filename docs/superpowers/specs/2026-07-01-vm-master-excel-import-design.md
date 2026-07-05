# VM Master Excel Import Design

Date: 2026-07-01
Branch: `feat/vm-master-cqrs-manual-edit`

## Goal

Integrate Excel to VM Master DB sync into the current VM Master business flow. Operators upload an Excel workbook from the VM Master Preview page, confirm one-to-one column mapping in an overlay card, then run an import that enriches each Excel row with AD and existing DB data before writing successful rows to SQLite.

The import uses Excel rows as the source of requested work. It does not fetch additional Helpdesk tickets. VM assignment completion follows the existing Helpdesk sync rule: resolve the imported user and manager, then infer missing VM assignment fields from the manager's current VM assignments in the DB.

## Non Goals

- No new standalone import script for this flow.
- No new package for multipart upload.
- No server-side temporary workbook storage.
- No per-sheet mapping in this iteration. One workbook-level mapping applies to every parsed worksheet.
- No full database replacement. This import upserts successful rows only.

## Existing Context

The current system already has:

- `server/vmMaster/helpdeskSync.ts`: Helpdesk ticket to VM Master sync with AD lookup, manager resolution, DB writes, warnings, and JSON execution logs.
- `server/vmMaster/repository.ts`: VM Master preview reads, manual edit commands, user upsert, manager assignment lookup, and assignment replacement helpers.
- `server/vmMaster/csv.ts`: VM Master CSV normalization for the existing CLI path.
- `server/vmMaster/syncLog.ts`: JSON execution history under `logs/`.
- `src/features/vm-master/VmMasterPreviewPage.vue`: VM Master Preview page with Sync Helpdesk, Execution history, Edit, Publish, and Refresh actions.
- `exceljs`: already installed and used by platform import code.

## User Flow

1. Operator clicks `Import Excel` in the VM Master Preview header.
2. Browser opens a native file picker accepting `.xlsx`.
3. The client reads the file as an `ArrayBuffer`, base64 encodes it, and posts it to a preview endpoint.
4. The server parses every worksheet with headers and data, then returns:
   - file name
   - worksheet names and row counts
   - workbook-level Excel headers, including the virtual `WORK_SHEET` column
   - sample rows
   - importable DB fields
   - default mapping
   - row count
5. The page opens a floating mapping card above the current preview page.
6. Each Excel column has a select for one DB field or blank.
7. If an Excel header matches a DB field after normalization, it is selected by default.
8. Mapping is one-to-one. Once a DB field is selected, other column selects disable that field.
9. Operator confirms the mapping.
10. The client posts the same workbook payload plus mapping to the execute endpoint.
11. The server validates mapping, imports row by row, writes successful rows, logs failed rows, and returns a summary.
12. The UI shows the import summary, refreshes VM Master Preview, and links to Execution history.

## Importable Fields

The import maps Excel columns to the persistent VM Master model:

- `AD_NAME`
- `CHN_NAME`
- `EMAIL_ADDRESS`
- `BG`
- `BU`
- `USER_ROLE`
- `GROUP_NAME`
- `VM_NAME`
- `MAX_ONLINE_USERS`
- `ZENTERA_ROLE`
- `USER_DEPT`
- `REPORT_TO`
- `BU_CURR`
- `BG_CURR`
- `WORK_SHEET`

`AD_NAME` is required for a row to import. `VM_NAME`, `GROUP_NAME`, and `ZENTERA_ROLE` may be provided by Excel or inferred from the manager's DB assignments. If a row cannot produce at least one assignment after enrichment and inference, it is treated as failed and no partial row is written.

`WORK_SHEET` is a virtual Excel column generated from the worksheet name. When mapped, it is written to `vm_user_vm_assignments.work_sheet`; every row from the same worksheet shares the same value.

## Mapping Rules

Header matching is normalized by trimming, uppercasing, and removing separators such as spaces, underscores, and hyphens. For example, `AD_NAME`, `AD Name`, and `adName` all match `AD_NAME`.

Default mapping is generated only when a normalized Excel header matches exactly one importable field. `WORK_SHEET` is generated for every parsed row and maps to `WORK_SHEET` by default. Operators can change all defaults before execution.

The execute endpoint rejects duplicate target DB fields. The UI prevents duplicates by disabling already selected fields in other selects.

## Backend Design

### Endpoints

Add VM Master endpoints:

- `POST /api/vm-master/import-excel/preview`
- `POST /api/vm-master/import-excel/execute`

Both endpoints accept JSON instead of multipart:

```json
{
  "fileName": "vm-master.xlsx",
  "workbookBase64": "..."
}
```

The execute endpoint also accepts:

```json
{
  "mapping": {
    "Excel Header": "AD_NAME"
  },
  "changedBy": "ALVIS.MC.TSAO"
}
```

This keeps the implementation dependency-free. The client holds the selected file in memory between preview and execute; the server does not store it.

### Core Modules

Add a small import module under `server/vmMaster/`:

- `excelImport.ts`: parse workbook buffer, derive headers/sample rows/default mapping, execute imports.
- `syncLog.ts`: extend the current log entry shape and file naming behavior so it can write/list/read VM Master execution logs for both Helpdesk sync and Excel import.

The implementation should reuse existing helpers where possible:

- `upsertVmUserForSync`
- `findManagerAdName`
- `findManagerAssignments`
- `replaceUserVmAssignments`
- `applyVmMasterSchema`
- `openVmMasterDatabase`
- `createAdLookupClient`

### Row Import Algorithm

For each Excel row:

1. Build a normalized row from mapping.
2. Require `AD_NAME`.
3. Lookup AD user by `AD_NAME`.
4. Fill blank user fields from AD:
   - `CHN_NAME`
   - `EMAIL_ADDRESS`
   - `BG`
   - `BU`
   - `USER_DEPT`
   - `REPORT_TO`
5. Fill remaining blanks from the existing `vm_users` row when available. AD lookup failure becomes a row warning, not an immediate row failure, if DB fallback still provides enough data to complete the row.
6. Resolve manager account using the same manager resolution behavior as Helpdesk sync.
7. Determine assignments:
   - If Excel provides `VM_NAME`, use the explicit Excel assignment values, filling missing `GROUP_NAME` and `ZENTERA_ROLE` from an existing assignment for that VM when possible.
   - If Excel does not provide `VM_NAME`, infer assignments from the manager's current assignments via `findManagerAssignments`.
8. If no assignment can be produced, record a failed row warning and skip DB writes for that row.
9. For successful rows, write in one row-level transaction:
   - upsert `vm_users`
   - upsert `vm_machines`
   - replace that user's assignments with the explicit or inferred assignments
10. Continue after row failures.

This gives each row all-or-nothing behavior while allowing the overall batch to partially succeed.

## Execution Record

The current execution history should become VM Master execution history, not only Helpdesk sync history.

Each log entry includes:

- `kind`: `helpdesk-sync` or `excel-import`
- `startedAt`
- `finishedAt`
- `ok`
- `requestSummary`
- `summary`
- `warnings`
- `logs`
- `error`

For Helpdesk sync, `requestSummary` includes:

- requested ticket count
- fetched ticket count
- parsed ticket count
- up to five ticket summaries: ticket id, requester, subject

For Excel import, `requestSummary` includes:

- file name
- worksheet name
- Excel row count
- mapped column count
- mapped fields
- up to five row summaries: row number, AD name, VM name if present

`summary` keeps the operation result counters. Excel import summary includes:

- `rowCount`
- `importedRowCount`
- `failedRowCount`
- `adEnrichedCount`
- `dbFilledCount`
- `managerInferredAssignmentCount`
- `explicitAssignmentCount`
- `warnings`
- `logId`
- `logPath`

The UI history panel displays the operation kind and uses the matching summary fields. Existing Helpdesk sync logs can keep reading as `helpdesk-sync` with a default kind if the field is missing.

## Frontend Design

`VmMasterPreviewPage.vue` adds:

- `Import Excel` secondary action.
- Hidden `<input type="file" accept=".xlsx">`.
- Mapping overlay card.
- Import success/error status.

The overlay card is rendered above the current page content with:

- file and worksheet metadata
- row count
- a compact mapping table
- one select per Excel header
- disabled options for already selected DB fields
- sample row values for confidence
- `Cancel` and `Import` actions

After import succeeds:

- close the overlay
- show summary
- call `loadPreview()`
- refresh execution history if the history panel is open

## Error Handling

Preview endpoint failures:

- malformed base64
- unreadable workbook
- no worksheet with headers
- no data rows

Execute endpoint failures:

- duplicate mapped DB field
- missing `AD_NAME` mapping
- workbook changed shape between preview and execute
- DB open/schema failure

Row-level failures do not fail the whole request unless every row fails. They are returned in warnings and written to the execution log.

The execute response is `ok: true` when at least one row imports. It is `ok: false` when the workbook cannot be processed or zero rows import.

## Testing Plan

Add focused tests before implementation:

- Excel preview extracts headers, sample rows, row count, and default mappings.
- Mapping validation rejects duplicate DB target fields and missing `AD_NAME`.
- Excel import enriches a row from mocked AD and infers VM assignments from a seeded manager in SQLite.
- Explicit Excel `VM_NAME` writes that assignment without manager inference.
- Failed rows are skipped, successful rows still write, and warnings include row numbers.
- Execution log includes `kind` and `requestSummary` for Excel import.
- Existing Helpdesk sync log entries include or default to `kind: helpdesk-sync` and include request-stage summaries.
- UI mapping state prevents duplicate target selection.

Run `pnpm test` and `pnpm build` after implementation.

## Open Decisions

No open decisions remain for this iteration.


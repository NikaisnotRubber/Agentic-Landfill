# PoC Architecture Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate the current PoC around fewer reusable core modules while preserving the working VM Master and platform mapping behavior.

**Architecture:** Keep the current Vite + Vue + Node/TS stack. Move duplicated or dangling IO helpers into shared project-owned modules, remove imports from deleted legacy modules, and keep route/UI state helpers small enough to reuse without creating a framework.

**Tech Stack:** pnpm, TypeScript, Vue 3 Composition API, TanStack Vue Table, csv-parse, ExcelJS, node:sqlite, Vitest.

---

### Task 1: Restore Dependency Consistency

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

- [ ] Add `exceljs` with `pnpm add exceljs`, because platform import/export and tests already use it.
- [ ] Run `pnpm build` to verify Vite still compiles.

### Task 2: Replace Deleted Zentera CSV Imports

**Files:**
- Create: `platform/io/csv.ts`
- Modify: `platform/import/importBatchFiles.ts`
- Modify: `platform/import/validateBatchFiles.ts`
- Test: `tests/platform/platformCsv.test.ts`

- [ ] Write a failing test for BOM-aware CSV parsing with headers, trim, and empty-line skipping.
- [ ] Implement `parseCsvRecords()` using `csv-parse/sync`.
- [ ] Replace imports from deleted `server/zentera/parseCsv`.
- [ ] Run `pnpm vitest run tests/platform/platformCsv.test.ts tests/platform/validateBatchFiles.test.ts`.

### Task 3: Move Role Inference Into Platform

**Files:**
- Modify: `platform/mapping/inferRoleFromHostname.ts`
- Test: `tests/platform/inferRoleFromHostname.test.ts`

- [ ] Write a failing test for extracting the role code from a VM hostname.
- [ ] Inline the small role-code parser in `platform/mapping/inferRoleFromHostname.ts`.
- [ ] Remove dependency on deleted `server/zentera/deriveRoleFromVmHostname`.
- [ ] Run the focused platform mapping tests.

### Task 4: Consolidate Browser API Fetching

**Files:**
- Create: `src/lib/http.ts`
- Modify: `src/features/vm-master/api.ts`
- Modify: `src/lib/api.ts`

- [ ] Add one `requestJson()` helper for GET/POST JSON responses.
- [ ] Replace repeated `fetch` + `response.json` + status fallback code.
- [ ] Keep endpoint-specific types in their current feature files.
- [ ] Run `pnpm build`.

### Task 5: Consolidate VM Master Async State

**Files:**
- Create: `src/features/vm-master/useAsyncTask.ts`
- Modify: `src/features/vm-master/useVmMasterPreview.ts`
- Modify: `src/features/vm-master/useHelpdeskVmSync.ts`
- Modify: `src/features/vm-master/useHelpdeskVmSyncLogs.ts`

- [ ] Add one small composable for loading/error state around async actions.
- [ ] Keep business-specific state, such as selected logs and sync summary, in the feature composables.
- [ ] Run `pnpm build`.

### Task 6: Migrate or Remove Obsolete Legacy Tests

**Files:**
- Modify/Delete: tests that import deleted `server/ddp/*`, `server/excel/*`, `server/zentera/*`, `server/sharepoint/*`, or `server/helpdeskVitePlugin`.

- [ ] Keep tests that exercise current public behavior.
- [ ] Delete tests that only lock removed helper modules.
- [ ] Replace broad legacy coverage with focused tests for consolidated public modules where needed.
- [ ] Run `pnpm test` and record remaining failures if any are environmental.

### Task 7: Update Operator Progress Docs

**Files:**
- Modify: `docs/PROGRESS.md`
- Modify: `docs/helpdesk-workflow.md` only if commands or operator behavior changed.

- [ ] Add a 2026-06-29 iteration row describing the architecture consolidation.
- [ ] Refresh last-updated metadata.
- [ ] Keep package-manager examples as `pnpm`.

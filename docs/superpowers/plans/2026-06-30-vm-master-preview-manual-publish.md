# VM Master Preview Manual Edit CQRS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add manual edit and publish support to VM Master Preview through a CQRS command-side workflow.

**Architecture:** `GET /api/vm-master/preview` remains query-only. `POST /api/vm-master/commands/manual-edit` validates dirty draft rows, writes a transactional command/outbox record plus row audit records, updates the VM Master write model, then the UI reloads the query projection.

**Tech Stack:** Vue 3 Composition API, TanStack Vue Table, Vite middleware, Node SQLite, Vitest.

---

### Task 1: Command/Outbox Schema And Service

**Files:**

- Modify: `db/schema/001_vm_master_schema.sql`
- Modify: `server/vmMaster/types.ts`
- Modify: `server/vmMaster/repository.ts`
- Test: `tests/vmMasterPublish.test.ts`

- [ ] Write failing tests for command execution, command audit rows, row before/after audit rows, VM rename, and missing row rejection.
- [ ] Add command/outbox tables to the VM Master schema.
- [ ] Add manual edit command request/result types.
- [ ] Implement `executeVmMasterManualEditCommand()` with validation and one SQLite transaction.
- [ ] Run `pnpm test tests/vmMasterPublish.test.ts`.

### Task 2: Command Route And API Separation

**Files:**

- Modify: `server/vmMaster/routes.ts`
- Create: `server/vmMaster/manualEditRoute.ts`
- Modify: `vite.config.ts`
- Test: `tests/vmMasterPublish.test.ts`

- [ ] Keep `createVmMasterPreviewHandler()` query-only.
- [ ] Add `createVmMasterManualEditCommandHandler()` for `POST /api/vm-master/commands/manual-edit`.
- [ ] Register the command route in Vite middleware.
- [ ] Run `pnpm test tests/vmMasterPublish.test.ts`.

### Task 3: Client Draft Editing

**Files:**

- Modify: `src/features/vm-master/types.ts`
- Modify: `src/features/vm-master/api.ts`
- Modify: `src/features/vm-master/useVmMasterPreview.ts`
- Modify: `src/features/vm-master/VmMasterPreviewPage.vue`
- Modify: `src/features/vm-master/VmMasterTable.vue`
- Modify: `src/styles.css`

- [ ] Add client command result and change payload types.
- [ ] Add `executeVmMasterManualEditCommand()` to the client API.
- [ ] Track edit mode, draft groups, dirty count, command loading, command error, and command success message in `useVmMasterPreview()`.
- [ ] Render inputs for editable detail cells while edit mode is active.
- [ ] Add `Edit`, `Cancel`, and `Publish` controls to the page header.
- [ ] Run `pnpm build`.

### Task 4: Docs And Progress

**Files:**

- Modify: `docs/helpdesk-workflow.md`
- Modify: `docs/PROGRESS.md`

- [ ] Document VM Master Preview manual edit and CQRS command behavior.
- [ ] Add the iteration to `docs/PROGRESS.md`.
- [ ] Run focused tests and build before final status.
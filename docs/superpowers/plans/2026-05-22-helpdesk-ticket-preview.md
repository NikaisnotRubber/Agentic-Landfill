# Helpdesk Ticket Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local Vue/Vite app that fetches Helpdesk tickets through Playwright and previews them in a searchable UI.

**Architecture:** Use a Vite app with a small Node middleware layer. Keep the Playwright fetcher as a server-side TypeScript module and expose thin local endpoints for sample data and live Helpdesk fetches.

**Tech Stack:** TypeScript, Vue 3, Vite, Vitest, Playwright

---

### Task 1: Scaffold project structure

**Files:**
- Create: `index.html`
- Create: `src/main.ts`
- Create: `src/App.vue`
- Create: `src/styles.css`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vitest.config.ts`

- [ ] Add the Vite/Vue app shell and TypeScript config.
- [ ] Wire a base stylesheet and root Vue mount.
- [ ] Add Vitest configuration for future tests.

### Task 2: Implement Playwright ticket fetch service

**Files:**
- Create: `server/helpdeskApi.ts`
- Create: `server/fetchTickets.ts`
- Create: `server/types.ts`

- [ ] Port the request URL-building logic from the Python script.
- [ ] Implement storage-state-based Playwright fetch.
- [ ] Detect 401/auth invalid payloads and return structured errors.
- [ ] Normalize nested Helpdesk response objects into UI-safe records.

### Task 3: Expose local middleware endpoints

**Files:**
- Modify: `vite.config.ts`
- Create: `server/sampleTickets.ts`

- [ ] Add `/api/tickets/sample` endpoint backed by `delta_tickets_clean.json`.
- [ ] Add `/api/tickets/fetch` endpoint backed by the Playwright service.
- [ ] Return consistent JSON envelopes for success and failure.

### Task 4: Build preview UI

**Files:**
- Modify: `src/App.vue`
- Create: `src/lib/api.ts`
- Create: `src/lib/types.ts`

- [ ] Add fetch controls and loading/error states.
- [ ] Add summary metrics and status banner.
- [ ] Add searchable ticket table and raw JSON inspector.
- [ ] Make the UI work with both sample and live fetch data.

### Task 5: Add focused tests

**Files:**
- Create: `tests/helpdeskApi.test.ts`
- Create: `tests/sampleFlow.test.ts`

- [ ] Test API URL generation.
- [ ] Test auth-failure detection and normalization helpers.
- [ ] Test the sample-data endpoint or UI helper path with static data.

### Task 6: Verify and run

**Files:**
- Modify: `package.json`

- [ ] Add scripts for `dev`, `build`, `test`, and `fetch:tickets`.
- [ ] Run tests and build.
- [ ] Start the dev server and confirm the preview page loads.

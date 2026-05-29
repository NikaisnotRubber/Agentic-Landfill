# Helpdesk Login Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local CLI workflow that logs into Helpdesk using the visible username/password form, writes a Playwright `storageState` file, and validates that state against the Helpdesk API.

**Architecture:** Build a focused `server/auth/` module set. Separate configuration loading, page locators, login form automation, and API validation so the CLI orchestration stays thin and testable.

**Tech Stack:** TypeScript, Playwright, Vitest, YAML parsing, local CLI via `tsx`

---

### Task 1: Add config support and ignore local auth secrets

**Files:**
- Modify: `.gitignore`
- Create: `config/helpdesk-auth.example.yaml`
- Create: `server/auth/helpdeskConfig.ts`
- Test: `tests/helpdeskConfig.test.ts`

- [ ] **Step 1: Write the failing config test**
- [ ] **Step 2: Verify the test fails because the auth config module does not exist**
- [ ] **Step 3: Implement YAML config parsing, validation, and defaults**
- [ ] **Step 4: Add ignored local config path in `.gitignore`**
- [ ] **Step 5: Add the checked-in YAML example file**
- [ ] **Step 6: Re-run the config test and confirm it passes**

### Task 2: Add login locators and login form automation

**Files:**
- Create: `server/auth/helpdeskLocators.ts`
- Create: `server/auth/helpdeskLogin.ts`
- Test: `tests/helpdeskLogin.test.ts`

- [ ] **Step 1: Write the failing login automation tests for username, password, domain, and submit**
- [ ] **Step 2: Verify the tests fail because the login modules do not exist**
- [ ] **Step 3: Implement semantic locator helpers for the observed login form**
- [ ] **Step 4: Implement the login flow using the config and locator helpers**
- [ ] **Step 5: Re-run the login tests and confirm they pass**

### Task 3: Add session verification against the Helpdesk API

**Files:**
- Create: `server/auth/verifyHelpdeskSession.ts`
- Test: `tests/verifyHelpdeskSession.test.ts`

- [ ] **Step 1: Write the failing verification tests for success, auth failure, and malformed payload**
- [ ] **Step 2: Verify the tests fail because the verification module does not exist**
- [ ] **Step 3: Implement API validation using a fresh context loaded from `storageState`**
- [ ] **Step 4: Re-run the verification tests and confirm they pass**

### Task 4: Add orchestration and CLI entrypoint

**Files:**
- Create: `server/auth/loginAndSaveState.ts`
- Create: `server/helpdeskLoginCli.ts`
- Modify: `package.json`
- Test: `tests/loginAndSaveState.test.ts`

- [ ] **Step 1: Write the failing orchestration test**
- [ ] **Step 2: Verify the orchestration test fails because the module does not exist**
- [ ] **Step 3: Implement orchestration that loads config, runs login, saves state, and validates it**
- [ ] **Step 4: Add the CLI entrypoint and `pnpm auth:login` script**
- [ ] **Step 5: Re-run the orchestration tests and confirm they pass**

### Task 5: Add a real-environment login validation script

**Files:**
- Create: `tests/e2e/helpdeskLogin.e2e.ts`

- [ ] **Step 1: Add a guarded live script that reads local YAML and runs the real login + validation flow**
- [ ] **Step 2: Ensure the script exits with a clear message if the local YAML file is missing**

### Task 6: Verify and commit

**Files:**
- Modify: any touched files above

- [ ] **Step 1: Run the full test suite**
- [ ] **Step 2: Run a production build**
- [ ] **Step 3: Check git status for intended changes only**
- [ ] **Step 4: Commit the completed login automation feature**

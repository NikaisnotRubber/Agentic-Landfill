# Helpdesk VM Sync Lifecycle Test Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a YAML-driven Vitest lifecycle test for Helpdesk VM sync covering user lookup/manager resolution, first DB write, and same-user update.

**Architecture:** Keep everything inside `tests/helpdesk-vm-sync-lifecycle/`. The test reads one local YAML config, uses the real `syncHelpdeskVmMaster`, uses a temp SQLite DB, and mocks only Helpdesk fetch plus AD lookup when `liveAdLookup` is disabled. No production code changes unless the test exposes a real sync bug.

**Tech Stack:** Vitest, TypeScript, `node:sqlite`, existing `yaml` package, existing `syncHelpdeskVmMaster`, existing VM Master repository/schema.

---

## Files

- Create: `tests/helpdesk-vm-sync-lifecycle/config.yaml`
  - Owns node toggles and test data.
- Create: `tests/helpdesk-vm-sync-lifecycle/lifecycle.test.ts`
  - Owns config loading, temp DB setup/cleanup, mocked Helpdesk fetch, optional live AD lookup, initial sync assertions, update sync assertions.
- Read only: `server/vmMaster/helpdeskSync.ts`
  - Real sync function under test.
- Read only: `server/vmMaster/repository.ts`
  - Defines current DB upsert/update behavior.
- Read only: `server/db/sqlite.ts`
  - Opens DB and applies schema.
- Optional doc update after implementation: `docs/PROGRESS.md`
  - Add one iteration row only after the test is implemented and verified.

Do not modify `docs/helpdesk-workflow.md`; operator behavior does not change.

---

### Task 1: Add Lifecycle YAML Config

**Files:**
- Create: `tests/helpdesk-vm-sync-lifecycle/config.yaml`

- [ ] **Step 1: Create the config folder and YAML file**

Use `apply_patch` to add:

```yaml
nodes:
  liveAdLookup: false
  initialSync: true
  updateSync: true

database:
  path: data/vm-master.sqlite
  resetBeforeRun: false
  keepAfterRun: true

user:
  adAccount: SUNGCHAO.SC.YU
  displayName: SUNGCHAO.SC.YU
  mail: SUNGCHAO.SC.YU@cyntec.com
  department: Software/Firmware Engineering HC Section
  manager: ALEX.MX.CHEN
  managerDn: "CN=ALEX.MX.CHEN,OU=RD1,OU=Users,OU=TWCYN,OU=TW,OU=Delta,DC=delta,DC=corp"
  employeeId: "763002"
  bg: CPBG
  bu: "CP R&D"

manager:
  adName: ALEX.MX.CHEN
  chnName: ALEX.MX.CHEN
  emailAddress: ""
  bg: CPBG
  bu: "CP R&D"
  vmAssignments:
    - vmName: TWPJDDP01
      groupName: DDP_USERS
      zenteraRole: DDP_USER

update:
  user:
    mail: sungchao.updated@example.test
    bg: CPBG
    bu: "CP R&D Updated"
  manager:
    vmAssignments:
      - vmName: TWPJDDP02
        groupName: DDP_POWER_USERS
        zenteraRole: DDP_POWER
```

- [ ] **Step 2: Verify the file exists**

Run:

```powershell
Get-Content -Raw tests\helpdesk-vm-sync-lifecycle\config.yaml
```

Expected: The YAML above is printed.

---

### Task 2: Write Config Loader and Validation Test

**Files:**
- Create: `tests/helpdesk-vm-sync-lifecycle/lifecycle.test.ts`

- [ ] **Step 1: Add the initial test file**

Use `apply_patch` to add this complete file:

```ts
import { readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import { parse } from "yaml";

import {
  createAdLookupClient,
  type AdLookupClient,
} from "../../server/ad/ldapClient";
import {
  resolveAdChineseName,
  resolveAdEnglishName,
} from "../../server/ad/normalizeAdEntry";
import {
  applyVmMasterSchema,
  openVmMasterDatabase,
  type VmMasterDatabase,
} from "../../server/db/sqlite";
import type { TicketRecord } from "../../server/types";
import { syncHelpdeskVmMaster } from "../../server/vmMaster/helpdeskSync";

type VmAssignmentConfig = {
  vmName: string;
  groupName: string;
  zenteraRole: string;
};

type UserConfig = {
  adAccount: string;
  displayName: string;
  mail: string;
  department: string;
  manager: string;
  managerDn: string;
  employeeId: string;
  bg: string;
  bu: string;
};

type ManagerConfig = {
  adName: string;
  chnName: string;
  emailAddress: string;
  bg: string;
  bu: string;
  vmAssignments: VmAssignmentConfig[];
};

type LifecycleConfig = {
  nodes: {
    liveAdLookup: boolean;
    initialSync: boolean;
    updateSync: boolean;
  };
  user: UserConfig;
  manager: ManagerConfig;
  update: {
    user: Partial<Pick<UserConfig, "mail" | "bg" | "bu">>;
    manager: {
      vmAssignments: VmAssignmentConfig[];
    };
  };
};

type ResolvedUser = UserConfig & {
  resolvedManagerAdName: string;
  expectManagerFallbackWarning: boolean;
};

const CONFIG_PATH = path.resolve(
  "tests/helpdesk-vm-sync-lifecycle/config.yaml",
);
const DB_PATH = path.resolve(
  "tests/fixtures/helpdesk-vm-sync-lifecycle-test.db",
);
const LOG_DIR = path.resolve(
  "tests/fixtures/helpdesk-vm-sync-lifecycle-logs",
);

let database: VmMasterDatabase | undefined;

function assertString(value: unknown, name: string): string {
  if (typeof value !== "string") {
    throw new Error(`${name} must be a string`);
  }
  return value;
}

function assertBoolean(value: unknown, name: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${name} must be a boolean`);
  }
  return value;
}

function assertAssignments(value: unknown, name: string): VmAssignmentConfig[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${name} must be a non-empty array`);
  }

  return value.map((entry, index) => {
    const record = entry as Record<string, unknown>;
    return {
      vmName: assertString(record.vmName, `${name}[${index}].vmName`),
      groupName: assertString(record.groupName, `${name}[${index}].groupName`),
      zenteraRole: assertString(
        record.zenteraRole,
        `${name}[${index}].zenteraRole`,
      ),
    };
  });
}

function loadConfig(): LifecycleConfig {
  const parsed = parse(readFileSync(CONFIG_PATH, "utf8")) as Record<string, unknown>;
  const nodes = parsed.nodes as Record<string, unknown>;
  const user = parsed.user as Record<string, unknown>;
  const manager = parsed.manager as Record<string, unknown>;
  const update = parsed.update as Record<string, unknown>;
  const updateUser = update.user as Record<string, unknown>;
  const updateManager = update.manager as Record<string, unknown>;

  const config: LifecycleConfig = {
    nodes: {
      liveAdLookup: assertBoolean(nodes.liveAdLookup, "nodes.liveAdLookup"),
      initialSync: assertBoolean(nodes.initialSync, "nodes.initialSync"),
      updateSync: assertBoolean(nodes.updateSync, "nodes.updateSync"),
    },
    user: {
      adAccount: assertString(user.adAccount, "user.adAccount"),
      displayName: assertString(user.displayName, "user.displayName"),
      mail: assertString(user.mail, "user.mail"),
      department: assertString(user.department, "user.department"),
      manager: assertString(user.manager, "user.manager"),
      managerDn: assertString(user.managerDn, "user.managerDn"),
      employeeId: assertString(user.employeeId, "user.employeeId"),
      bg: assertString(user.bg, "user.bg"),
      bu: assertString(user.bu, "user.bu"),
    },
    manager: {
      adName: assertString(manager.adName, "manager.adName"),
      chnName: assertString(manager.chnName, "manager.chnName"),
      emailAddress: assertString(manager.emailAddress, "manager.emailAddress"),
      bg: assertString(manager.bg, "manager.bg"),
      bu: assertString(manager.bu, "manager.bu"),
      vmAssignments: assertAssignments(
        manager.vmAssignments,
        "manager.vmAssignments",
      ),
    },
    update: {
      user: {
        mail:
          typeof updateUser.mail === "string" ? updateUser.mail : undefined,
        bg: typeof updateUser.bg === "string" ? updateUser.bg : undefined,
        bu: typeof updateUser.bu === "string" ? updateUser.bu : undefined,
      },
      manager: {
        vmAssignments: assertAssignments(
          updateManager.vmAssignments,
          "update.manager.vmAssignments",
        ),
      },
    },
  };

  if (
    !config.nodes.liveAdLookup &&
    !config.nodes.initialSync &&
    !config.nodes.updateSync
  ) {
    throw new Error("At least one lifecycle node must be enabled");
  }

  return config;
}

afterEach(async () => {
  database?.close();
  database = undefined;
  await rm(DB_PATH, { force: true });
  await rm(LOG_DIR, { recursive: true, force: true });
});

describe("Helpdesk VM sync lifecycle config", () => {
  it("loads lifecycle YAML config", () => {
    const config = loadConfig();

    expect(config.user.adAccount).toBe("SUNGCHAO.SC.YU");
    expect(config.manager.adName).toBe("ALEX.MX.CHEN");
    expect(config.manager.vmAssignments).toHaveLength(1);
    expect(config.update.manager.vmAssignments).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the config loader test**

Run:

```powershell
pnpm vitest run tests/helpdesk-vm-sync-lifecycle/lifecycle.test.ts -t config
```

Expected: PASS with `1 passed`.

---

### Task 3: Add Initial Sync Lifecycle Test

**Files:**
- Modify: `tests/helpdesk-vm-sync-lifecycle/lifecycle.test.ts`

- [ ] **Step 1: Add lifecycle helpers below `loadConfig()`**

Use `apply_patch` to add:

```ts
function openLifecycleDatabase(): VmMasterDatabase {
  database = openVmMasterDatabase(DB_PATH);
  applyVmMasterSchema(database);
  return database;
}

function seedManager(
  db: VmMasterDatabase,
  manager: ManagerConfig,
  assignments = manager.vmAssignments,
): void {
  db.prepare(
    `
      INSERT INTO vm_users (ad_name, chn_name, email_address, bg, bu, report_to)
      VALUES (?, ?, ?, ?, ?, '')
      ON CONFLICT(ad_name) DO UPDATE SET
        chn_name = excluded.chn_name,
        email_address = excluded.email_address,
        bg = excluded.bg,
        bu = excluded.bu
    `,
  ).run(
    manager.adName,
    manager.chnName,
    manager.emailAddress,
    manager.bg,
    manager.bu,
  );

  db.prepare("DELETE FROM vm_user_vm_assignments WHERE ad_name = ?").run(
    manager.adName,
  );

  const insertMachine = db.prepare(
    "INSERT INTO vm_machines (vm_name) VALUES (?) ON CONFLICT(vm_name) DO NOTHING",
  );
  const insertAssignment = db.prepare(
    `
      INSERT INTO vm_user_vm_assignments (ad_name, vm_name, group_name, zentera_role)
      VALUES (?, ?, ?, ?)
    `,
  );

  for (const assignment of assignments) {
    insertMachine.run(assignment.vmName);
    insertAssignment.run(
      manager.adName,
      assignment.vmName,
      assignment.groupName,
      assignment.zenteraRole,
    );
  }
}

function createTicket(account: string, id: string): TicketRecord {
  return {
    id,
    subject: "DDP VM access request",
    requester: account,
    technician: "",
    created_time: "2026-06-18 09:00:00",
    site: "Taipei",
    category: "DDP",
    status: "Open",
    group: "Help Desk",
    short_description: `AD Account: ${account}`,
  };
}

function createMockLookupClient(user: ResolvedUser): AdLookupClient {
  return {
    async lookupUser(account) {
      if (account !== user.adAccount) {
        return null;
      }

      return {
        adAccount: user.adAccount,
        displayName: user.displayName,
        mail: user.mail,
        department: user.department,
        manager: user.manager,
        managerDn: user.managerDn,
        employeeId: user.employeeId,
        bg: user.bg,
        bu: user.bu,
      };
    },
    async lookupManagerAccount() {
      return user.expectManagerFallbackWarning
        ? null
        : {
            adAccount: user.resolvedManagerAdName,
            displayName: user.resolvedManagerAdName,
          };
    },
    async close() {},
  };
}

async function resolveUser(config: LifecycleConfig): Promise<ResolvedUser> {
  if (!config.nodes.liveAdLookup) {
    return {
      ...config.user,
      resolvedManagerAdName: config.manager.adName,
      expectManagerFallbackWarning: false,
    };
  }

  const client = createAdLookupClient();
  try {
    const user = await client.lookupUser(config.user.adAccount);
    if (!user) {
      throw new Error(`Live AD lookup did not find ${config.user.adAccount}`);
    }

    const manager = user.managerDn
      ? await client.lookupManagerAccount(user.managerDn)
      : null;
    const resolvedManagerAdName =
      manager?.adAccount || resolveAdEnglishName(user.manager);
    if (!resolvedManagerAdName) {
      throw new Error(
        `Live AD lookup did not resolve manager for ${config.user.adAccount}`,
      );
    }

    return {
      adAccount: user.adAccount,
      displayName: user.displayName,
      mail: user.mail,
      department: user.department,
      manager: user.manager,
      managerDn: user.managerDn,
      employeeId: user.employeeId,
      bg: user.bg,
      bu: user.bu,
      resolvedManagerAdName,
      expectManagerFallbackWarning: !manager?.adAccount && Boolean(user.manager),
    };
  } finally {
    await client.close();
  }
}

function selectUser(db: VmMasterDatabase, account: string) {
  return db
    .prepare(
      `
        SELECT
          ad_name,
          chn_name,
          email_address,
          bg,
          bu,
          user_dept,
          report_to,
          bu_curr,
          bg_curr
        FROM vm_users
        WHERE ad_name = ?
      `,
    )
    .get(account);
}

function selectAssignments(db: VmMasterDatabase, account: string) {
  return db
    .prepare(
      `
        SELECT ad_name, vm_name, group_name, zentera_role
        FROM vm_user_vm_assignments
        WHERE ad_name = ?
        ORDER BY vm_name
      `,
    )
    .all(account);
}

function expectedWarnings(user: ResolvedUser, ticketId: string) {
  return user.expectManagerFallbackWarning
    ? [
        {
          ticketId,
          adName: user.adAccount,
          stage: "manager-resolution",
          code: "manager-account-fallback",
          message: `manager account fallback used for ${user.adAccount}`,
          detail: `REPORT_TO=${user.resolvedManagerAdName}`,
        },
      ]
    : [];
}
```

- [ ] **Step 2: Add the initial sync test**

Use `apply_patch` to add this `describe` block after the config test:

```ts
describe("Helpdesk VM sync lifecycle", () => {
  it("runs configured lookup and initial DB write nodes", async () => {
    const config = loadConfig();
    const resolvedUser = await resolveUser(config);
    const db = openLifecycleDatabase();
    seedManager(db, {
      ...config.manager,
      adName: resolvedUser.resolvedManagerAdName,
      chnName: resolvedUser.resolvedManagerAdName,
    });

    if (!config.nodes.initialSync) {
      expect(config.nodes.initialSync).toBe(false);
      return;
    }

    const ticketId = "HD-LIFECYCLE-INITIAL";
    const result = await syncHelpdeskVmMaster(
      { count: 1 },
      {
        openDatabase: () => db,
        createLookupClient: () => createMockLookupClient(resolvedUser),
        logDir: LOG_DIR,
        fetchTickets: async () => ({
          ok: true,
          source: "live",
          count: 1,
          tickets: [createTicket(resolvedUser.adAccount, ticketId)],
        }),
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.summary).toMatchObject({
      fetchedTicketCount: 1,
      parsedTicketCount: 1,
      ldapEnrichedCount: 1,
      managerMatchedCount: 1,
      userUpsertedCount: 1,
      assignmentInsertedCount: config.manager.vmAssignments.length,
    });
    expect(result.summary.warnings).toEqual(
      expectedWarnings(resolvedUser, ticketId),
    );

    expect(selectUser(db, resolvedUser.adAccount)).toEqual({
      ad_name: resolvedUser.adAccount,
      chn_name: resolveAdChineseName(resolvedUser.displayName),
      email_address: resolvedUser.mail,
      bg: resolvedUser.bg,
      bu: resolvedUser.bu,
      user_dept: resolvedUser.department,
      report_to: resolvedUser.resolvedManagerAdName,
      bu_curr: resolvedUser.bu,
      bg_curr: resolvedUser.bg,
    });
    expect(selectAssignments(db, resolvedUser.adAccount)).toEqual(
      config.manager.vmAssignments.map((assignment) => ({
        ad_name: resolvedUser.adAccount,
        vm_name: assignment.vmName,
        group_name: assignment.groupName,
        zentera_role: assignment.zenteraRole,
      })),
    );
  }, 60_000);
});
```

- [ ] **Step 3: Run the initial sync test**

Run:

```powershell
pnpm vitest run tests/helpdesk-vm-sync-lifecycle/lifecycle.test.ts -t "initial DB write"
```

Expected: PASS with `1 passed`.

---

### Task 4: Add Same-User Update Lifecycle Test

**Files:**
- Modify: `tests/helpdesk-vm-sync-lifecycle/lifecycle.test.ts`

- [ ] **Step 1: Add update helpers below `expectedWarnings()`**

Use `apply_patch` to add:

```ts
function applyUserUpdate(
  user: ResolvedUser,
  update: LifecycleConfig["update"]["user"],
): ResolvedUser {
  return {
    ...user,
    mail: update.mail ?? user.mail,
    bg: update.bg ?? user.bg,
    bu: update.bu ?? user.bu,
  };
}

async function runSync(
  db: VmMasterDatabase,
  user: ResolvedUser,
  ticketId: string,
) {
  return syncHelpdeskVmMaster(
    { count: 1 },
    {
      openDatabase: () => db,
      createLookupClient: () => createMockLookupClient(user),
      logDir: LOG_DIR,
      fetchTickets: async () => ({
        ok: true,
        source: "live",
        count: 1,
        tickets: [createTicket(user.adAccount, ticketId)],
      }),
    },
  );
}
```

- [ ] **Step 2: Replace the inline initial sync call with `runSync`**

In the initial sync test, replace:

```ts
const result = await syncHelpdeskVmMaster(
  { count: 1 },
  {
    openDatabase: () => db,
    createLookupClient: () => createMockLookupClient(resolvedUser),
    logDir: LOG_DIR,
    fetchTickets: async () => ({
      ok: true,
      source: "live",
      count: 1,
      tickets: [createTicket(resolvedUser.adAccount, ticketId)],
    }),
  },
);
```

with:

```ts
const result = await runSync(db, resolvedUser, ticketId);
```

- [ ] **Step 3: Add the update test inside the lifecycle describe block**

Use `apply_patch` to add:

```ts
  it("runs configured same-user update node", async () => {
    const config = loadConfig();
    const initialUser = await resolveUser(config);
    const updatedUser = applyUserUpdate(initialUser, config.update.user);
    const db = openLifecycleDatabase();
    const manager = {
      ...config.manager,
      adName: initialUser.resolvedManagerAdName,
      chnName: initialUser.resolvedManagerAdName,
    };

    seedManager(db, manager);
    const initialResult = await runSync(db, initialUser, "HD-LIFECYCLE-INITIAL");
    expect(initialResult.ok).toBe(true);

    if (!config.nodes.updateSync) {
      expect(config.nodes.updateSync).toBe(false);
      return;
    }

    seedManager(db, manager, config.update.manager.vmAssignments);
    const updateTicketId = "HD-LIFECYCLE-UPDATE";
    const updateResult = await runSync(db, updatedUser, updateTicketId);

    expect(updateResult.ok).toBe(true);
    if (!updateResult.ok) {
      return;
    }

    expect(updateResult.summary).toMatchObject({
      fetchedTicketCount: 1,
      parsedTicketCount: 1,
      ldapEnrichedCount: 1,
      managerMatchedCount: 1,
      userUpsertedCount: 1,
      assignmentInsertedCount: config.update.manager.vmAssignments.length,
    });
    expect(updateResult.summary.warnings).toEqual(
      expectedWarnings(updatedUser, updateTicketId),
    );

    const rows = db
      .prepare("SELECT count(*) AS count FROM vm_users WHERE ad_name = ?")
      .get(updatedUser.adAccount) as { count: number };
    expect(rows.count).toBe(1);

    expect(selectUser(db, updatedUser.adAccount)).toEqual({
      ad_name: updatedUser.adAccount,
      chn_name: resolveAdChineseName(updatedUser.displayName),
      email_address: updatedUser.mail,
      bg: initialUser.bg,
      bu: initialUser.bu,
      user_dept: updatedUser.department,
      report_to: updatedUser.resolvedManagerAdName,
      bu_curr: updatedUser.bu,
      bg_curr: updatedUser.bg,
    });
    expect(selectAssignments(db, updatedUser.adAccount)).toEqual(
      config.update.manager.vmAssignments.map((assignment) => ({
        ad_name: updatedUser.adAccount,
        vm_name: assignment.vmName,
        group_name: assignment.groupName,
        zentera_role: assignment.zenteraRole,
      })),
    );
  }, 60_000);
```

- [ ] **Step 4: Run the update test**

Run:

```powershell
pnpm vitest run tests/helpdesk-vm-sync-lifecycle/lifecycle.test.ts -t "same-user update"
```

Expected: PASS with `1 passed`.

---

### Task 5: Run Full Lifecycle Test File

**Files:**
- Test: `tests/helpdesk-vm-sync-lifecycle/lifecycle.test.ts`

- [ ] **Step 1: Run the full lifecycle test file**

Run:

```powershell
pnpm vitest run tests/helpdesk-vm-sync-lifecycle/lifecycle.test.ts
```

Expected:

```text
Test Files  1 passed (1)
Tests       3 passed (3)
```

The exact duration may vary. With `liveAdLookup: false`, this should not require network or AD credentials.

- [ ] **Step 2: Confirm temp files are cleaned**

Run:

```powershell
Test-Path tests\fixtures\helpdesk-vm-sync-lifecycle-test.db
Test-Path tests\fixtures\helpdesk-vm-sync-lifecycle-logs
```

Expected when `database.path` is a temp fixture path and `database.keepAfterRun` is `false`:

```text
False
False
```

With the current service-preview DB config (`path: data/vm-master.sqlite`, `resetBeforeRun: false`, `keepAfterRun: true`), the DB path is expected to remain so the synced rows can be inspected manually.

---

### Task 6: Update Progress Document

**Files:**
- Modify: `docs/PROGRESS.md`

- [ ] **Step 1: Update the top last-updated line**

Find the line near the top that starts with:

```markdown
> **最後更新**
```

Change only that line to:

```markdown
> **最後更新**：2026-06-18（**Helpdesk VM sync lifecycle test**）
```

- [ ] **Step 2: Add one iteration row in the iteration-record table**

Add:

```markdown
| **2026-06-18** | **Helpdesk VM sync lifecycle test** | 新增 YAML-driven lifecycle 測試，覆蓋主管定位、首次 DB 寫入、同用戶更新與 VM assignment replace |
```

- [ ] **Step 3: Run the lifecycle test again**

Run:

```powershell
pnpm vitest run tests/helpdesk-vm-sync-lifecycle/lifecycle.test.ts
```

Expected:

```text
Test Files  1 passed (1)
Tests       3 passed (3)
```

---

## Optional Live AD Check

Run this only when the machine has AD connectivity and the operator intentionally wants a live lookup:

- [ ] **Step 1: Temporarily set `liveAdLookup: true` in config**

In `tests/helpdesk-vm-sync-lifecycle/config.yaml`, change:

```yaml
liveAdLookup: true
```

- [ ] **Step 2: Run the lifecycle test**

Run:

```powershell
pnpm vitest run tests/helpdesk-vm-sync-lifecycle/lifecycle.test.ts
```

Expected: PASS. If simple bind credentials are absent, `manager-account-fallback` warnings are acceptable as long as DB rows use the fallback manager account.

- [ ] **Step 3: Restore default config**

Change it back:

```yaml
liveAdLookup: false
```

Run:

```powershell
pnpm vitest run tests/helpdesk-vm-sync-lifecycle/lifecycle.test.ts
```

Expected: PASS with `3 passed`.

---

## Completion Checklist

- [ ] `tests/helpdesk-vm-sync-lifecycle/config.yaml` exists.
- [ ] `tests/helpdesk-vm-sync-lifecycle/lifecycle.test.ts` exists.
- [ ] Default config has `liveAdLookup: false`.
- [ ] Config points at `data/vm-master.sqlite` with `database.resetBeforeRun: false` and `database.keepAfterRun: true` so service-preview DB rows can be inspected after the run.
- [ ] Test verifies DB rows directly, not only sync summary.
- [ ] Test covers initial insert.
- [ ] Test covers same-user update.
- [ ] Test verifies old user assignments are replaced by update assignments.
- [ ] `docs/PROGRESS.md` updated after implementation.
- [ ] `pnpm vitest run tests/helpdesk-vm-sync-lifecycle/lifecycle.test.ts` passes.

Commit only if the user explicitly requests it, because the current worktree already contains unrelated uncommitted changes.

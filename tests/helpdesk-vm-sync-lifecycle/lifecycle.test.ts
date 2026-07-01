import { readFileSync, rmSync } from "node:fs";
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
  database: {
    path: string;
    resetBeforeRun: boolean;
    keepAfterRun: boolean;
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

const CONFIG_PATH = path.resolve("tests/helpdesk-vm-sync-lifecycle/config.yaml");
const LOG_DIR = path.resolve(
  "tests/fixtures/helpdesk-vm-sync-lifecycle-logs",
);

let database: VmMasterDatabase | undefined;
let databasePath: string | undefined;

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

function assertRecord(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${name} must be an object`);
  }
  return value as Record<string, unknown>;
}

function optionalString(
  record: Record<string, unknown>,
  key: string,
  name: string,
): string | undefined {
  if (!(key in record)) {
    return undefined;
  }
  return assertString(record[key], name);
}

function assertAssignments(value: unknown, name: string): VmAssignmentConfig[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${name} must be a non-empty array`);
  }

  return value.map((entry, index) => {
    const record = assertRecord(entry, `${name}[${index}]`);
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
  const parsed = assertRecord(
    parse(readFileSync(CONFIG_PATH, "utf8")),
    "config",
  );
  const nodes = assertRecord(parsed.nodes, "nodes");
  const database = assertRecord(parsed.database, "database");
  const user = assertRecord(parsed.user, "user");
  const manager = assertRecord(parsed.manager, "manager");
  const update = assertRecord(parsed.update, "update");
  const updateUser = assertRecord(update.user, "update.user");
  const updateManager = assertRecord(update.manager, "update.manager");

  const config: LifecycleConfig = {
    nodes: {
      liveAdLookup: assertBoolean(nodes.liveAdLookup, "nodes.liveAdLookup"),
      initialSync: assertBoolean(nodes.initialSync, "nodes.initialSync"),
      updateSync: assertBoolean(nodes.updateSync, "nodes.updateSync"),
    },
    database: {
      path: assertString(database.path, "database.path"),
      resetBeforeRun: assertBoolean(
        database.resetBeforeRun,
        "database.resetBeforeRun",
      ),
      keepAfterRun: assertBoolean(
        database.keepAfterRun,
        "database.keepAfterRun",
      ),
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
        mail: optionalString(updateUser, "mail", "update.user.mail"),
        bg: optionalString(updateUser, "bg", "update.user.bg"),
        bu: optionalString(updateUser, "bu", "update.user.bu"),
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

function openLifecycleDatabase(config: LifecycleConfig): VmMasterDatabase {
  databasePath = path.resolve(config.database.path);
  if (config.database.resetBeforeRun) {
    rmSync(databasePath, { force: true });
  }
  rmSync(LOG_DIR, { recursive: true, force: true });
  database = openVmMasterDatabase(databasePath);
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

function clearSyncedUser(db: VmMasterDatabase, account: string): void {
  db.prepare("DELETE FROM vm_user_vm_assignments WHERE ad_name = ?").run(account);
  db.prepare("DELETE FROM vm_users WHERE ad_name = ?").run(account);
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
    async lookupManagerAccount(managerDn) {
      if (managerDn !== user.managerDn) {
        return null;
      }

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

function expectedAssignmentRows(
  assignments: VmAssignmentConfig[],
  account: string,
) {
  return [...assignments]
    .sort((left, right) => left.vmName.localeCompare(right.vmName))
    .map((assignment) => ({
      ad_name: account,
      vm_name: assignment.vmName,
      group_name: assignment.groupName,
      zentera_role: assignment.zenteraRole,
    }));
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

afterEach(async () => {
  const config = loadConfig();
  database?.close();
  database = undefined;
  if (!config.database.keepAfterRun && databasePath) {
    await rm(databasePath, { force: true });
  }
  databasePath = undefined;
  await rm(LOG_DIR, { recursive: true, force: true });
});

describe("Helpdesk VM sync lifecycle config", () => {
  it("loads lifecycle YAML config", () => {
    const config = loadConfig();

    expect(config.user.adAccount).toBe("SUNGCHAO.SC.YU");
    expect(config.database.path).toBe("data/vm-master.sqlite");
    expect(config.database.resetBeforeRun).toBe(false);
    expect(config.manager.adName).toBe("ALEX.MX.CHEN");
    expect(config.manager.vmAssignments).toHaveLength(1);
    expect(config.update.manager.vmAssignments).toHaveLength(2);
  });
});

describe("Helpdesk VM sync lifecycle", () => {
  it("runs configured lookup and initial DB write nodes", async () => {
    const config = loadConfig();
    const resolvedUser = await resolveUser(config);
    const db = openLifecycleDatabase(config);
    clearSyncedUser(db, resolvedUser.adAccount);
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
    const result = await runSync(db, resolvedUser, ticketId);

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
      expectedAssignmentRows(
        config.manager.vmAssignments,
        resolvedUser.adAccount,
      ),
    );
  }, 60_000);

  it("runs configured same-user update node", async () => {
    const config = loadConfig();
    const resolvedUser = await resolveUser(config);
    const updatedUser = applyUserUpdate(resolvedUser, config.update.user);
    const db = openLifecycleDatabase(config);
    clearSyncedUser(db, resolvedUser.adAccount);
    const manager = {
      ...config.manager,
      adName: resolvedUser.resolvedManagerAdName,
      chnName: resolvedUser.resolvedManagerAdName,
    };

    seedManager(db, manager);

    const initialTicketId = "HD-LIFECYCLE-SAME-USER-INITIAL";
    const initialResult = await runSync(db, resolvedUser, initialTicketId);

    expect(initialResult.ok).toBe(true);
    if (!initialResult.ok) {
      return;
    }

    if (!config.nodes.updateSync) {
      expect(config.nodes.updateSync).toBe(false);
      return;
    }

    seedManager(db, manager, config.update.manager.vmAssignments);

    const updateTicketId = "HD-LIFECYCLE-SAME-USER-UPDATE";
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
      assignmentReplacedCount: config.update.manager.vmAssignments.length,
      assignmentInsertedCount: config.update.manager.vmAssignments.length,
    });
    expect(updateResult.summary.warnings).toEqual(
      expectedWarnings(updatedUser, updateTicketId),
    );

    expect(
      db
        .prepare("SELECT COUNT(*) AS count FROM vm_users WHERE ad_name = ?")
        .get(resolvedUser.adAccount),
    ).toEqual({ count: 1 });
    expect(selectUser(db, resolvedUser.adAccount)).toEqual({
      ad_name: resolvedUser.adAccount,
      chn_name: resolveAdChineseName(updatedUser.displayName),
      email_address: updatedUser.mail,
      bg: resolvedUser.bg,
      bu: resolvedUser.bu,
      user_dept: updatedUser.department,
      report_to: resolvedUser.resolvedManagerAdName,
      bu_curr: updatedUser.bu,
      bg_curr: updatedUser.bg,
    });
    expect(selectAssignments(db, resolvedUser.adAccount)).toEqual(
      expectedAssignmentRows(
        config.update.manager.vmAssignments,
        resolvedUser.adAccount,
      ),
    );
  }, 60_000);
});

import { rm } from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createAdLookupClient, type AdLookupClient } from "../server/ad/ldapClient";
import { resolveAdEnglishName } from "../server/ad/normalizeAdEntry";
import { applyVmMasterSchema, openVmMasterDatabase, type VmMasterDatabase } from "../server/db/sqlite";
import { syncHelpdeskVmMaster } from "../server/vmMaster/helpdeskSync";

const DB_PATH = path.resolve("tests/fixtures/helpdesk-vm-sync-test.db");
const LOG_DIR = path.resolve("tests/fixtures/helpdesk-vm-sync-logs");

let database: VmMasterDatabase | undefined;

type SeededManager = {
  adName: string;
  chnName: string;
  emailAddress: string;
  bg: string;
  bu: string;
};

const DEFAULT_MANAGER: SeededManager = {
  adName: "LEO.ZOU",
  chnName: "Leo Zou",
  emailAddress: "leo.zou@example.test",
  bg: "DBG",
  bu: "DDP",
};

function openSeededDatabase(manager = DEFAULT_MANAGER) {
  database = openVmMasterDatabase(DB_PATH);
  applyVmMasterSchema(database);
  database
    .prepare(
      "INSERT INTO vm_users (ad_name, chn_name, email_address, bg, bu, report_to) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(manager.adName, manager.chnName, manager.emailAddress, manager.bg, manager.bu, "");
  database.prepare("INSERT INTO vm_machines (vm_name) VALUES (?)").run("TWPJDDP01");
  database
    .prepare(
      "INSERT INTO vm_user_vm_assignments (ad_name, vm_name, group_name, zentera_role) VALUES (?, ?, ?, ?)",
    )
    .run(manager.adName, "TWPJDDP01", "DDP_USERS", "DDP_USER");
  return database;
}

function createMockLookupClient(): AdLookupClient {
  return {
    async lookupUser(account) {
      if (account === "CHUNKAI.LIU") {
        return {
          adAccount: "CHUNKAI.LIU",
          displayName: "Chunkai Liu",
          mail: "chunkai.liu@example.test",
          department: "DDP",
          manager: "Leo Zou",
          managerDn: "CN=Leo Zou,OU=Users,DC=example,DC=test",
          employeeId: "T12345",
          bg: "DBG",
          bu: "DDP",
        };
      }

      return null;
    },
    async lookupManagerAccount(managerDn) {
      return managerDn ? { adAccount: "LEO.ZOU", displayName: "Leo Zou" } : null;
    },
    async close() {},
  };
}

async function lookupLiveUserAndManager(account: string) {
  const client = createAdLookupClient();
  try {
    const user = await client.lookupUser(account);
    if (!user) {
      throw new Error(`Live AD lookup did not find ${account}`);
    }

    const manager = user.managerDn ? await client.lookupManagerAccount(user.managerDn) : null;
    const managerAdName = manager?.adAccount || resolveAdEnglishName(user.manager);
    if (!managerAdName) {
      throw new Error(`Live AD lookup did not resolve manager for ${account}`);
    }

    return { user, managerAdName };
  } finally {
    await client.close();
  }
}

afterEach(async () => {
  database?.close();
  database = undefined;
  await rm(DB_PATH, { force: true });
  await rm(LOG_DIR, { recursive: true, force: true });
});

describe("syncHelpdeskVmMaster", () => {
  it("syncs a CHUNKAI.LIU help desk ticket into VM master assignments", async () => {
    const db = openSeededDatabase();

    const result = await syncHelpdeskVmMaster(
      { count: 1 },
      {
        openDatabase: () => db,
        createLookupClient: createMockLookupClient,
        logDir: LOG_DIR,
        fetchTickets: async () => ({
          ok: true,
          source: "live",
          count: 1,
          tickets: [
            {
              id: "HD-CHUNKAI-LIU-001",
              subject: "DDP VM access request",
              requester: "CHUNKAI.LIU",
              technician: "",
              created_time: "2026-06-17 09:00:00",
              site: "Taipei",
              category: "DDP",
              status: "Open",
              group: "Help Desk",
              short_description: "AD Account: CHUNKAI.LIU",
            },
          ],
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
      assignmentInsertedCount: 1,
    });
    expect(result.summary.warnings).toEqual([]);

    const user = db
      .prepare("SELECT ad_name, email_address, bg, bu, report_to FROM vm_users WHERE ad_name = ?")
      .get("CHUNKAI.LIU");
    expect(user).toEqual({
      ad_name: "CHUNKAI.LIU",
      email_address: "chunkai.liu@example.test",
      bg: "DBG",
      bu: "DDP",
      report_to: "LEO.ZOU",
    });

    const assignment = db
      .prepare(
        "SELECT ad_name, vm_name, group_name, zentera_role FROM vm_user_vm_assignments WHERE ad_name = ?",
      )
      .get("CHUNKAI.LIU");
    expect(assignment).toEqual({
      ad_name: "CHUNKAI.LIU",
      vm_name: "TWPJDDP01",
      group_name: "DDP_USERS",
      zentera_role: "DDP_USER",
    });
  });

  it("syncs a SUNGCHAO.SC.YU help desk ticket into VM master assignments", async () => {
    const { user: liveUser, managerAdName } = await lookupLiveUserAndManager("SUNGCHAO.SC.YU");
    expect(managerAdName).not.toBe("LEO.ZOU");

    const db = openSeededDatabase({
      adName: managerAdName,
      chnName: managerAdName,
      emailAddress: "",
      bg: liveUser.bg,
      bu: liveUser.bu,
    });

    const result = await syncHelpdeskVmMaster(
      { count: 1 },
      {
        openDatabase: () => db,
        createLookupClient: createAdLookupClient,
        logDir: LOG_DIR,
        fetchTickets: async () => ({
          ok: true,
          source: "live",
          count: 1,
          tickets: [
            {
              id: "HD-SUNGCHAO-SC-YU-001",
              subject: "DDP VM access request",
              requester: "SUNGCHAO.SC.YU",
              technician: "",
              created_time: "2026-06-18 09:00:00",
              site: "Taipei",
              category: "DDP",
              status: "Open",
              group: "Help Desk",
              short_description: "AD Account: SUNGCHAO.SC.YU",
            },
          ],
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
      assignmentInsertedCount: 1,
    });
    expect(result.summary.warnings).toEqual([
      {
        ticketId: "HD-SUNGCHAO-SC-YU-001",
        adName: "SUNGCHAO.SC.YU",
        stage: "manager-resolution",
        code: "manager-account-fallback",
        message: "manager account fallback used for SUNGCHAO.SC.YU",
        detail: `REPORT_TO=${managerAdName}`,
      },
    ]);

    const user = db
      .prepare("SELECT ad_name, email_address, bg, bu, report_to FROM vm_users WHERE ad_name = ?")
      .get("SUNGCHAO.SC.YU");
    expect(user).toEqual({
      ad_name: liveUser.adAccount,
      email_address: liveUser.mail,
      bg: liveUser.bg,
      bu: liveUser.bu,
      report_to: managerAdName,
    });

    const assignment = db
      .prepare(
        "SELECT ad_name, vm_name, group_name, zentera_role FROM vm_user_vm_assignments WHERE ad_name = ?",
      )
      .get("SUNGCHAO.SC.YU");
    expect(assignment).toEqual({
      ad_name: "SUNGCHAO.SC.YU",
      vm_name: "TWPJDDP01",
      group_name: "DDP_USERS",
      zentera_role: "DDP_USER",
    });
  }, 60_000);
});

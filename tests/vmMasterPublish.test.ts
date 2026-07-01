import { describe, expect, it, vi } from "vitest";

import { applyVmMasterSchema, openVmMasterDatabase } from "../server/db/sqlite";
import { createVmMasterManualEditCommandHandler } from "../server/vmMaster/manualEditRoute";
import { createVmMasterPreviewHandler } from "../server/vmMaster/routes";
import {
  executeVmMasterManualEditCommand,
  listVmMasterPreviewGroups,
} from "../server/vmMaster/repository";

function createMockResponse() {
  return {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: "",
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
    end(payload: string) {
      this.body = payload;
    },
  };
}

function openSeededDatabase() {
  const db = openVmMasterDatabase(":memory:");
  applyVmMasterSchema(db);
  db.prepare(
    `
      INSERT INTO vm_users (
        ad_name, chn_name, email_address, bg, bu, user_role, user_dept, report_to, bu_curr, bg_curr
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  ).run(
    "LEO.ZOU",
    "Leo Zou",
    "leo.zou@example.test",
    "DBG",
    "DDP",
    "USER",
    "IT",
    "MANAGER.AD",
    "DDP",
    "DBG",
  );
  db.prepare("INSERT INTO vm_machines (vm_name, max_online_users) VALUES (?, ?)").run(
    "TWPJDDP01",
    12,
  );
  db.prepare(
    `
      INSERT INTO vm_user_vm_assignments (ad_name, vm_name, group_name, zentera_role)
      VALUES (?, ?, ?, ?)
    `,
  ).run("LEO.ZOU", "TWPJDDP01", "DDP_USERS", "DDP_USER");
  return db;
}

describe("executeVmMasterManualEditCommand", () => {
  it("updates write-model tables and records command/audit rows atomically", () => {
    const db = openSeededDatabase();

    try {
      const result = executeVmMasterManualEditCommand(db, {
        changedBy: "ALVIS.MC.TSAO",
        changes: [
          {
            originalAdName: "LEO.ZOU",
            originalVmName: "TWPJDDP01",
            row: {
              adName: "LEO.ZOU",
              chnName: "Leo Chou",
              emailAddress: "leo.chou@example.test",
              bg: "DBG2",
              bu: "DDP2",
              userRole: "ADMIN",
              userDept: "OPS",
              reportTo: "NEW.MANAGER",
              buCurr: "DDP2",
              bgCurr: "DBG2",
              groupName: "DDP_ADMINS",
              vmName: "TWPJDDP02",
              maxOnlineUsers: 20,
              zenteraRole: "DDP_ADMIN",
            },
          },
        ],
      });

      expect(result.commandId).toEqual(expect.any(String));
      expect(result.updatedCount).toBe(1);

      const command = db
        .prepare(
          `
            SELECT id, command_type, status, changed_by, applied_at, published_at, error
            FROM vm_master_manual_edit_commands
            WHERE id = ?
          `,
        )
        .get(result.commandId);
      expect(command).toMatchObject({
        id: result.commandId,
        command_type: "vm_master.manual_edit",
        status: "applied",
        changed_by: "ALVIS.MC.TSAO",
        published_at: null,
        error: null,
      });
      expect((command as { applied_at: string }).applied_at).toEqual(expect.any(String));

      const audit = db
        .prepare(
          `
            SELECT original_ad_name, original_vm_name, before_json, after_json
            FROM vm_master_manual_edit_changes
            WHERE command_id = ?
          `,
        )
        .get(result.commandId) as {
        original_ad_name: string;
        original_vm_name: string;
        before_json: string;
        after_json: string;
      };
      expect(audit.original_ad_name).toBe("LEO.ZOU");
      expect(audit.original_vm_name).toBe("TWPJDDP01");
      expect(JSON.parse(audit.before_json)).toMatchObject({
        chnName: "Leo Zou",
        vmName: "TWPJDDP01",
        maxOnlineUsers: 12,
      });
      expect(JSON.parse(audit.after_json)).toMatchObject({
        chnName: "Leo Chou",
        vmName: "TWPJDDP02",
        maxOnlineUsers: 20,
      });

      expect(
        db.prepare("SELECT max_online_users FROM vm_machines WHERE vm_name = ?").get("TWPJDDP02"),
      ).toEqual({ max_online_users: 20 });
      expect(
        db.prepare("SELECT vm_name FROM vm_machines WHERE vm_name = ?").get("TWPJDDP01"),
      ).toBeUndefined();
      expect(
        db
          .prepare(
            `
              SELECT ad_name, vm_name, group_name, zentera_role
              FROM vm_user_vm_assignments
              WHERE ad_name = ?
            `,
          )
          .get("LEO.ZOU"),
      ).toEqual({
        ad_name: "LEO.ZOU",
        vm_name: "TWPJDDP02",
        group_name: "DDP_ADMINS",
        zentera_role: "DDP_ADMIN",
      });

      expect(listVmMasterPreviewGroups(db)[0].rows[0]).toMatchObject({
        chnName: "Leo Chou",
        vmName: "TWPJDDP02",
        maxOnlineUsers: 20,
        zenteraRole: "DDP_ADMIN",
      });
    } finally {
      db.close();
    }
  });

  it("rolls back command records when the target row does not exist", () => {
    const db = openSeededDatabase();

    try {
      expect(() =>
        executeVmMasterManualEditCommand(db, {
          changedBy: "operator",
          changes: [
            {
              originalAdName: "MISSING.USER",
              originalVmName: "TWPJDDP01",
              row: {
                adName: "MISSING.USER",
                chnName: "",
                emailAddress: "",
                bg: "",
                bu: "",
                userRole: "",
                userDept: "",
                reportTo: "",
                buCurr: "",
                bgCurr: "",
                groupName: "",
                vmName: "TWPJDDP01",
                maxOnlineUsers: null,
                zenteraRole: "",
              },
            },
          ],
        }),
      ).toThrow("VM Master row not found");

      expect(
        db.prepare("SELECT COUNT(*) AS count FROM vm_master_manual_edit_commands").get(),
      ).toEqual({ count: 0 });
      expect(
        db.prepare("SELECT COUNT(*) AS count FROM vm_master_manual_edit_changes").get(),
      ).toEqual({ count: 0 });
    } finally {
      db.close();
    }
  });
});

describe("VM Master CQRS routes", () => {
  it("keeps the preview route query-only", async () => {
    const handler = createVmMasterPreviewHandler({ listPreviewGroups: vi.fn().mockReturnValue([]) });
    const response = createMockResponse();

    await handler({ method: "PUT" } as never, response as never);

    expect(response.statusCode).toBe(405);
    expect(JSON.parse(response.body)).toEqual({ ok: false, error: "Method not allowed" });
  });

  it("rejects malformed manual edit command payloads", async () => {
    const handler = createVmMasterManualEditCommandHandler(
      { execute: vi.fn() },
      { readBody: vi.fn().mockResolvedValue("{") },
    );
    const response = createMockResponse();

    await handler({ method: "POST" } as never, response as never);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({
      ok: false,
      error: "Malformed VM Master manual edit command payload",
    });
  });
});
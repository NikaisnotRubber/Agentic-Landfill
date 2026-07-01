import { describe, expect, it } from "vitest";

import { applyVmMasterSchema, openVmMasterDatabase } from "../server/db/sqlite";

describe("VM master schema", () => {
  it("migrates VM machines with max online users and exposes it in preview", () => {
    const db = openVmMasterDatabase(":memory:");

    try {
      db.exec(`
        CREATE TABLE vm_users (
          ad_name TEXT PRIMARY KEY,
          chn_name TEXT NOT NULL DEFAULT '',
          email_address TEXT NOT NULL DEFAULT '',
          bg TEXT NOT NULL DEFAULT '',
          bu TEXT NOT NULL DEFAULT '',
          user_role TEXT NOT NULL DEFAULT '',
          user_dept TEXT NOT NULL DEFAULT '',
          report_to TEXT NOT NULL DEFAULT '',
          bu_curr TEXT NOT NULL DEFAULT '',
          bg_curr TEXT NOT NULL DEFAULT '',
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE vm_machines (
          vm_name TEXT PRIMARY KEY,
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE vm_user_vm_assignments (
          ad_name TEXT NOT NULL REFERENCES vm_users(ad_name) ON DELETE CASCADE,
          vm_name TEXT NOT NULL REFERENCES vm_machines(vm_name) ON DELETE CASCADE,
          group_name TEXT NOT NULL DEFAULT '',
          zentera_role TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          PRIMARY KEY (ad_name, vm_name)
        );
      `);

      applyVmMasterSchema(db);

      const columns = db.prepare("PRAGMA table_info(vm_machines)").all() as Array<{
        name: string;
      }>;
      expect(columns.map((column) => column.name)).toContain("max_online_users");

      db.prepare(
        `
          INSERT INTO vm_users (ad_name, chn_name, email_address, bg, bu)
          VALUES ('LEO.ZOU', 'Leo Zou', 'leo.zou@example.test', 'DBG', 'DDP')
        `,
      ).run();
      db.prepare("INSERT INTO vm_machines (vm_name, max_online_users) VALUES (?, ?)").run(
        "TWPJDDP01",
        12,
      );
      db.prepare(
        `
          INSERT INTO vm_user_vm_assignments (ad_name, vm_name, group_name, zentera_role)
          VALUES ('LEO.ZOU', 'TWPJDDP01', 'DDP_USERS', 'DDP_USER')
        `,
      ).run();

      const preview = db.prepare("SELECT rows FROM vm_master_preview_by_bg").get() as {
        rows: string;
      };
      expect(JSON.parse(preview.rows)[0]).toMatchObject({ maxOnlineUsers: 12 });
    } finally {
      db.close();
    }
  });
});

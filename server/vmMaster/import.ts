import type { VmMasterDatabase } from "../db/sqlite";
import type { VmMasterAssignment } from "./types";

function uniqueBy<T>(rows: T[], keyFor: (row: T) => string): T[] {
  const seen = new Set<string>();
  const uniqueRows: T[] = [];

  for (const row of rows) {
    const key = keyFor(row);
    if (!seen.has(key)) {
      seen.add(key);
      uniqueRows.push(row);
    }
  }

  return uniqueRows;
}

export function importVmMasterRows(database: VmMasterDatabase, rows: VmMasterAssignment[]): void {
  if (rows.length === 0) {
    throw new Error("VM master import requires at least one row");
  }

  const users = uniqueBy(rows, (row) => row.adName);
  const machines = uniqueBy(rows, (row) => row.vmName);

  const insertUser = database.prepare(`
    INSERT INTO vm_users (
      ad_name, chn_name, email_address, bg, bu, user_role, user_dept, report_to, bu_curr, bg_curr
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(ad_name) DO UPDATE SET
      chn_name = excluded.chn_name,
      email_address = excluded.email_address,
      bg = excluded.bg,
      bu = excluded.bu,
      user_role = excluded.user_role,
      user_dept = excluded.user_dept,
      report_to = excluded.report_to,
      bu_curr = excluded.bu_curr,
      bg_curr = excluded.bg_curr,
      updated_at = datetime('now')
  `);

  const insertMachine = database.prepare(`
    INSERT INTO vm_machines (vm_name)
    VALUES (?)
    ON CONFLICT(vm_name) DO UPDATE SET
      updated_at = datetime('now')
  `);

  const insertAssignment = database.prepare(`
    INSERT INTO vm_user_vm_assignments (ad_name, vm_name, group_name, zentera_role)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(ad_name, vm_name) DO UPDATE SET
      group_name = excluded.group_name,
      zentera_role = excluded.zentera_role,
      updated_at = datetime('now')
  `);

  database.exec("BEGIN");

  try {
    database.exec("DELETE FROM vm_user_vm_assignments");
    database.exec("DELETE FROM vm_machines");
    database.exec("DELETE FROM vm_users");

    for (const row of users) {
      insertUser.run(
        row.adName,
        row.chnName,
        row.emailAddress,
        row.bg,
        row.bu,
        row.userRole,
        row.userDept,
        row.reportTo,
        row.buCurr,
        row.bgCurr,
      );
    }

    for (const row of machines) {
      insertMachine.run(row.vmName);
    }

    for (const row of rows) {
      insertAssignment.run(row.adName, row.vmName, row.groupName, row.zenteraRole);
    }

    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

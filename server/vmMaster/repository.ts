import { randomUUID } from "node:crypto";
import { openVmMasterDatabase, type VmMasterDatabase } from "../db/sqlite";
import type {
  VmAssignmentInput,
  VmMasterBgGroup,
  VmMasterManualEditCommand,
  VmMasterManualEditCommandResult,
  VmMasterPreviewRow,
  VmUserSyncInput,
} from "./types";

type VmMasterPreviewDbRow = {
  bg: string;
  assignment_count: number;
  user_count: number;
  vm_count: number;
  rows: string;
};

type ExistingUserState =
  | {
      bg: string;
      bg_curr: string;
      bu: string;
      bu_curr: string;
    }
  | undefined;

type VmMasterJoinedRow = {
  bg: string;
  ad_name: string;
  chn_name: string;
  email_address: string;
  bu: string;
  user_role: string;
  user_dept: string;
  report_to: string;
  bu_curr: string;
  bg_curr: string;
  group_name: string;
  vm_name: string;
  max_online_users: number | null;
  zentera_role: string;
};

function resolveCurrentPair(existingValue: string, existingCurrent: string, incoming: string) {
  if (!incoming) {
    return { value: existingValue, current: existingCurrent };
  }
  if (!existingValue && !existingCurrent) {
    return { value: incoming, current: incoming };
  }
  if (incoming === existingCurrent) {
    return { value: existingValue, current: existingCurrent };
  }
  if (!existingCurrent) {
    return { value: existingValue, current: incoming };
  }
  return { value: existingCurrent, current: incoming };
}

function mapJoinedRow(row: VmMasterJoinedRow): VmMasterPreviewRow {
  return {
    bg: row.bg,
    adName: row.ad_name,
    chnName: row.chn_name,
    emailAddress: row.email_address,
    bu: row.bu,
    userRole: row.user_role,
    userDept: row.user_dept,
    reportTo: row.report_to,
    buCurr: row.bu_curr,
    bgCurr: row.bg_curr,
    groupName: row.group_name,
    vmName: row.vm_name,
    maxOnlineUsers: row.max_online_users,
    zenteraRole: row.zentera_role,
  };
}

export function mapVmMasterPreviewRow(row: VmMasterPreviewDbRow): VmMasterBgGroup {
  return {
    bg: row.bg,
    assignmentCount: Number(row.assignment_count),
    userCount: Number(row.user_count),
    vmCount: Number(row.vm_count),
    rows: JSON.parse(row.rows) as VmMasterPreviewRow[],
  };
}

export function listVmMasterPreviewGroups(
  database: VmMasterDatabase = openVmMasterDatabase(),
): VmMasterBgGroup[] {
  const rows = database.prepare(`
    SELECT bg, assignment_count, user_count, vm_count, rows
    FROM vm_master_preview_by_bg
    ORDER BY bg
  `).all() as VmMasterPreviewDbRow[];

  return rows.map(mapVmMasterPreviewRow);
}

function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new Error(`VM Master manual edit field ${fieldName} must be a string`);
  }
  return value.trim();
}

function normalizeMaxOnlineUsers(value: unknown): number | null {
  if (value === null) {
    return null;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(
      "VM Master manual edit field maxOnlineUsers must be a non-negative integer or null",
    );
  }
  return value;
}

function normalizeManualEditRow(row: unknown): VmMasterPreviewRow {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    throw new Error("VM Master manual edit row must be an object");
  }

  const record = row as Record<string, unknown>;
  return {
    adName: requireString(record.adName, "adName"),
    chnName: requireString(record.chnName, "chnName"),
    emailAddress: requireString(record.emailAddress, "emailAddress"),
    bg: requireString(record.bg, "bg"),
    bu: requireString(record.bu, "bu"),
    userRole: requireString(record.userRole, "userRole"),
    userDept: requireString(record.userDept, "userDept"),
    reportTo: requireString(record.reportTo, "reportTo"),
    buCurr: requireString(record.buCurr, "buCurr"),
    bgCurr: requireString(record.bgCurr, "bgCurr"),
    groupName: requireString(record.groupName, "groupName"),
    vmName: requireString(record.vmName, "vmName"),
    maxOnlineUsers: normalizeMaxOnlineUsers(record.maxOnlineUsers),
    zenteraRole: requireString(record.zenteraRole, "zenteraRole"),
  };
}

export function parseVmMasterManualEditCommand(payload: unknown): VmMasterManualEditCommand {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("VM Master manual edit command payload must be an object");
  }

  const record = payload as Record<string, unknown>;
  const changedBy =
    record.changedBy === undefined || record.changedBy === null
      ? undefined
      : requireString(record.changedBy, "changedBy");
  const changes = record.changes;
  if (!Array.isArray(changes)) {
    throw new Error("VM Master manual edit changes must be an array");
  }

  return {
    changedBy,
    changes: changes.map((change, index) => {
      if (!change || typeof change !== "object" || Array.isArray(change)) {
        throw new Error(`VM Master manual edit change ${index + 1} must be an object`);
      }

      const changeRecord = change as Record<string, unknown>;
      const originalAdName = requireString(changeRecord.originalAdName, "originalAdName");
      const originalVmName = requireString(changeRecord.originalVmName, "originalVmName");
      const row = normalizeManualEditRow(changeRecord.row);

      if (!originalAdName || !originalVmName || !row.adName || !row.vmName) {
        throw new Error("VM Master manual edit row identity fields cannot be blank");
      }
      if (row.adName !== originalAdName) {
        throw new Error("VM Master manual edit cannot change adName");
      }

      return { originalAdName, originalVmName, row };
    }),
  };
}

function runInTransaction<T>(database: VmMasterDatabase, fn: () => T): T {
  database.exec("BEGIN");
  try {
    const result = fn();
    database.exec("COMMIT");
    return result;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function loadPreviewRow(
  database: VmMasterDatabase,
  adName: string,
  vmName: string,
): VmMasterPreviewRow | null {
  const row = database
    .prepare(`
      SELECT
        users.bg,
        users.ad_name,
        users.chn_name,
        users.email_address,
        users.bu,
        users.user_role,
        users.user_dept,
        users.report_to,
        users.bu_curr,
        users.bg_curr,
        assignments.group_name,
        machines.vm_name,
        machines.max_online_users,
        assignments.zentera_role
      FROM vm_user_vm_assignments assignments
      INNER JOIN vm_users users ON users.ad_name = assignments.ad_name
      INNER JOIN vm_machines machines ON machines.vm_name = assignments.vm_name
      WHERE assignments.ad_name = ? AND assignments.vm_name = ?
    `)
    .get(adName, vmName) as VmMasterJoinedRow | undefined;

  return row ? mapJoinedRow(row) : null;
}

export function executeVmMasterManualEditCommand(
  database: VmMasterDatabase,
  payload: VmMasterManualEditCommand,
): VmMasterManualEditCommandResult {
  const command = parseVmMasterManualEditCommand(payload);
  const commandId = randomUUID();
  const payloadJson = JSON.stringify(command);

  return runInTransaction(database, () => {
    database
      .prepare(`
        INSERT INTO vm_master_manual_edit_commands (
          id, command_type, status, payload_json, changed_by, applied_at
        )
        VALUES (?, 'vm_master.manual_edit', 'applied', ?, ?, datetime('now'))
      `)
      .run(commandId, payloadJson, command.changedBy ?? null);

    const updateUser = database.prepare(`
      UPDATE vm_users
      SET
        chn_name = ?,
        email_address = ?,
        bg = ?,
        bu = ?,
        user_role = ?,
        user_dept = ?,
        report_to = ?,
        bu_curr = ?,
        bg_curr = ?,
        updated_at = datetime('now')
      WHERE ad_name = ?
    `);
    const upsertMachine = database.prepare(`
      INSERT INTO vm_machines (vm_name, max_online_users)
      VALUES (?, ?)
      ON CONFLICT(vm_name) DO UPDATE SET
        max_online_users = excluded.max_online_users,
        updated_at = datetime('now')
    `);
    const updateAssignment = database.prepare(`
      UPDATE vm_user_vm_assignments
      SET
        vm_name = ?,
        group_name = ?,
        zentera_role = ?,
        updated_at = datetime('now')
      WHERE ad_name = ? AND vm_name = ?
    `);
    const deleteUnusedMachine = database.prepare(`
      DELETE FROM vm_machines
      WHERE vm_name = ?
        AND NOT EXISTS (
          SELECT 1 FROM vm_user_vm_assignments WHERE vm_name = ?
        )
    `);
    const insertAudit = database.prepare(`
      INSERT INTO vm_master_manual_edit_changes (
        id, command_id, original_ad_name, original_vm_name, before_json, after_json
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const change of command.changes) {
      const before = loadPreviewRow(database, change.originalAdName, change.originalVmName);
      if (!before) {
        throw new Error(
          `VM Master row not found: ${change.originalAdName} / ${change.originalVmName}`,
        );
      }

      updateUser.run(
        change.row.chnName,
        change.row.emailAddress,
        change.row.bg,
        change.row.bu,
        change.row.userRole,
        change.row.userDept,
        change.row.reportTo,
        change.row.buCurr,
        change.row.bgCurr,
        change.originalAdName,
      );
      upsertMachine.run(change.row.vmName, change.row.maxOnlineUsers);
      updateAssignment.run(
        change.row.vmName,
        change.row.groupName,
        change.row.zenteraRole,
        change.originalAdName,
        change.originalVmName,
      );
      if (change.row.vmName !== change.originalVmName) {
        deleteUnusedMachine.run(change.originalVmName, change.originalVmName);
      }

      insertAudit.run(
        randomUUID(),
        commandId,
        change.originalAdName,
        change.originalVmName,
        JSON.stringify(before),
        JSON.stringify(change.row),
      );
    }

    return { commandId, updatedCount: command.changes.length };
  });
}
export function upsertVmUserForSync(
  database: VmMasterDatabase,
  input: VmUserSyncInput,
): void {
  const existing = database
    .prepare("SELECT bg, bg_curr, bu, bu_curr FROM vm_users WHERE ad_name = ?")
    .get(input.adName) as ExistingUserState;

  const bg = resolveCurrentPair(existing?.bg ?? "", existing?.bg_curr ?? "", input.bg);
  const bu = resolveCurrentPair(existing?.bu ?? "", existing?.bu_curr ?? "", input.bu);

  database
    .prepare(`
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
    `)
    .run(
      input.adName,
      input.chnName,
      input.emailAddress,
      bg.value,
      bu.value,
      input.userRole,
      input.userDept,
      input.reportTo,
      bu.current,
      bg.current,
    );
}

export function findManagerAdName(database: VmMasterDatabase, reportTo: string): string {
  const normalized = reportTo.trim();
  if (!normalized) {
    return "";
  }

  const byAdName = database
    .prepare("SELECT ad_name FROM vm_users WHERE ad_name = ?")
    .get(normalized) as { ad_name: string } | undefined;
  if (byAdName) {
    return byAdName.ad_name;
  }

  const byChineseName = database
    .prepare("SELECT ad_name FROM vm_users WHERE chn_name = ?")
    .get(normalized) as { ad_name: string } | undefined;
  return byChineseName?.ad_name ?? "";
}

export function findManagerAssignments(
  database: VmMasterDatabase,
  managerAdName: string,
): VmAssignmentInput[] {
  const rows = database
    .prepare(`
      SELECT vm_name, group_name, zentera_role
      FROM vm_user_vm_assignments
      WHERE ad_name = ?
      ORDER BY vm_name
    `)
    .all(managerAdName) as Array<{
      vm_name: string;
      group_name: string;
      zentera_role: string;
    }>;

  return rows.map((row) => ({
    vmName: row.vm_name,
    groupName: row.group_name,
    zenteraRole: row.zentera_role,
  }));
}

export function findVmUserForImport(
  database: VmMasterDatabase,
  adName: string,
): (VmUserSyncInput & { buCurr: string; bgCurr: string }) | null {
  const row = database
    .prepare(
      `SELECT ad_name, chn_name, email_address, bg, bu, user_role, user_dept, report_to, bu_curr, bg_curr
       FROM vm_users WHERE ad_name = ?`,
    )
    .get(adName) as
    | {
        ad_name: string;
        chn_name: string;
        email_address: string;
        bg: string;
        bu: string;
        user_role: string;
        user_dept: string;
        report_to: string;
        bu_curr: string;
        bg_curr: string;
      }
    | undefined;

  return row
    ? {
        adName: row.ad_name,
        chnName: row.chn_name,
        emailAddress: row.email_address,
        bg: row.bg,
        bu: row.bu,
        userRole: row.user_role,
        userDept: row.user_dept,
        reportTo: row.report_to,
        buCurr: row.bu_curr,
        bgCurr: row.bg_curr,
      }
    : null;
}

export function findAssignmentDefaultsForVm(
  database: VmMasterDatabase,
  vmName: string,
): VmAssignmentInput | null {
  const row = database
    .prepare(
      `SELECT vm_name, group_name, zentera_role
       FROM vm_user_vm_assignments
       WHERE vm_name = ?
       ORDER BY updated_at DESC
       LIMIT 1`,
    )
    .get(vmName) as
    | { vm_name: string; group_name: string; zentera_role: string }
    | undefined;

  return row
    ? { vmName: row.vm_name, groupName: row.group_name, zenteraRole: row.zentera_role }
    : null;
}
export function replaceUserVmAssignments(
  database: VmMasterDatabase,
  adName: string,
  assignments: VmAssignmentInput[],
): { replacedCount: number; insertedCount: number } {
  database.prepare("DELETE FROM vm_user_vm_assignments WHERE ad_name = ?").run(adName);

  const insertMachine = database.prepare(`
    INSERT INTO vm_machines (vm_name)
    VALUES (?)
    ON CONFLICT(vm_name) DO UPDATE SET updated_at = datetime('now')
  `);
  const insertAssignment = database.prepare(`
    INSERT INTO vm_user_vm_assignments (ad_name, vm_name, group_name, zentera_role)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(ad_name, vm_name) DO UPDATE SET
      group_name = excluded.group_name,
      zentera_role = excluded.zentera_role,
      updated_at = datetime('now')
  `);

  for (const assignment of assignments) {
    insertMachine.run(assignment.vmName);
    insertAssignment.run(adName, assignment.vmName, assignment.groupName, assignment.zenteraRole);
  }

  return {
    replacedCount: assignments.length,
    insertedCount: assignments.length,
  };
}

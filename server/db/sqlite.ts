import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

export type VmMasterDatabase = DatabaseSync;

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const schemaPath = path.join(rootDir, "db/schema/001_vm_master_schema.sql");

export function getSqliteDbPath(env: NodeJS.ProcessEnv = process.env): string {
  return env.SQLITE_DB_PATH || "data/vm-master.sqlite";
}

export function openVmMasterDatabase(databasePath = getSqliteDbPath()): VmMasterDatabase {
  if (databasePath !== ":memory:") {
    mkdirSync(path.dirname(databasePath), { recursive: true });
  }

  const database = new DatabaseSync(databasePath);
  database.exec("PRAGMA foreign_keys = ON");
  return database;
}

type TableInfoRow = {
  name: string;
};

function listColumnNames(database: VmMasterDatabase, tableName: string): Set<string> {
  const rows = database.prepare(`PRAGMA table_info(${tableName})`).all() as TableInfoRow[];
  return new Set(rows.map((row) => row.name));
}

function ensureColumn(
  database: VmMasterDatabase,
  tableName: string,
  columnName: string,
  definition: string,
): void {
  const columns = listColumnNames(database, tableName);
  if (!columns.has(columnName)) {
    database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

function migrateVmMasterAssignmentColumns(database: VmMasterDatabase): void {
  ensureColumn(database, "vm_user_vm_assignments", "group_name", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(database, "vm_user_vm_assignments", "zentera_role", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(database, "vm_user_vm_assignments", "work_sheet", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(database, "vm_machines", "max_online_users", "INTEGER");

  const machineColumns = listColumnNames(database, "vm_machines");
  if (machineColumns.has("group_name") || machineColumns.has("zentera_role")) {
    database.exec(`
      UPDATE vm_user_vm_assignments
      SET
        group_name = COALESCE(NULLIF(group_name, ''), (
          SELECT COALESCE(vm_machines.group_name, '')
          FROM vm_machines
          WHERE vm_machines.vm_name = vm_user_vm_assignments.vm_name
        ), ''),
        zentera_role = COALESCE(NULLIF(zentera_role, ''), (
          SELECT COALESCE(vm_machines.zentera_role, '')
          FROM vm_machines
          WHERE vm_machines.vm_name = vm_user_vm_assignments.vm_name
        ), '')
    `);
  }
}

function recreateVmMasterPreviewView(database: VmMasterDatabase): void {
  database.exec(`
    DROP VIEW IF EXISTS vm_master_preview_by_bg;

    CREATE VIEW vm_master_preview_by_bg AS
    SELECT
      users.bg,
      count(*) AS assignment_count,
      count(DISTINCT users.ad_name) AS user_count,
      count(DISTINCT machines.vm_name) AS vm_count,
      json_group_array(
        json_object(
          'bg', users.bg,
          'adName', users.ad_name,
          'chnName', users.chn_name,
          'emailAddress', users.email_address,
          'bu', users.bu,
          'userRole', users.user_role,
          'userDept', users.user_dept,
          'reportTo', users.report_to,
          'buCurr', users.bu_curr,
          'bgCurr', users.bg_curr,
          'groupName', assignments.group_name,
          'vmName', machines.vm_name,
          'maxOnlineUsers', machines.max_online_users,
          'zenteraRole', assignments.zentera_role,
          'workSheet', assignments.work_sheet
        )
      ) AS rows
    FROM vm_user_vm_assignments assignments
    INNER JOIN vm_users users ON users.ad_name = assignments.ad_name
    INNER JOIN vm_machines machines ON machines.vm_name = assignments.vm_name
    GROUP BY users.bg;
  `);
}

export function applyVmMasterSchema(database: VmMasterDatabase): void {
  const sql = readFileSync(schemaPath, "utf8");
  database.exec(sql);
  migrateVmMasterAssignmentColumns(database);
  recreateVmMasterPreviewView(database);
}

export function migrateVmMasterDatabase(databasePath = getSqliteDbPath()): void {
  const database = openVmMasterDatabase(databasePath);

  try {
    applyVmMasterSchema(database);
  } finally {
    database.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}` && process.argv.includes("--migrate")) {
  try {
    migrateVmMasterDatabase();
    console.log(`VM master SQLite schema applied to ${getSqliteDbPath()}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

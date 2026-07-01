CREATE TABLE IF NOT EXISTS vm_users (
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

CREATE TABLE IF NOT EXISTS vm_machines (
  vm_name TEXT PRIMARY KEY,
  max_online_users INTEGER,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS vm_user_vm_assignments (
  ad_name TEXT NOT NULL REFERENCES vm_users(ad_name) ON DELETE CASCADE,
  vm_name TEXT NOT NULL REFERENCES vm_machines(vm_name) ON DELETE CASCADE,
  group_name TEXT NOT NULL DEFAULT '',
  zentera_role TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (ad_name, vm_name)
);

CREATE INDEX IF NOT EXISTS vm_users_bg_idx
  ON vm_users(bg);

CREATE INDEX IF NOT EXISTS vm_user_vm_assignments_vm_name_idx
  ON vm_user_vm_assignments(vm_name);
CREATE TABLE IF NOT EXISTS vm_master_manual_edit_commands (
  id TEXT PRIMARY KEY,
  command_type TEXT NOT NULL,
  status TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  changed_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  applied_at TEXT,
  published_at TEXT,
  error TEXT
);

CREATE TABLE IF NOT EXISTS vm_master_manual_edit_changes (
  id TEXT PRIMARY KEY,
  command_id TEXT NOT NULL REFERENCES vm_master_manual_edit_commands(id) ON DELETE CASCADE,
  original_ad_name TEXT NOT NULL,
  original_vm_name TEXT NOT NULL,
  before_json TEXT NOT NULL,
  after_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS vm_master_manual_edit_changes_command_idx
  ON vm_master_manual_edit_changes(command_id);

CREATE VIEW IF NOT EXISTS vm_master_preview_by_bg AS
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
      'zenteraRole', assignments.zentera_role
    )
  ) AS rows
FROM vm_user_vm_assignments assignments
INNER JOIN vm_users users ON users.ad_name = assignments.ad_name
INNER JOIN vm_machines machines ON machines.vm_name = assignments.vm_name
GROUP BY users.bg;

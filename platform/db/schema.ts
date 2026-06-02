export const PLATFORM_MIGRATIONS = [
  `
CREATE TABLE IF NOT EXISTS batches (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'draft',
  rule_version TEXT NOT NULL DEFAULT '1.0.0',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  published_at TEXT
);
`,
  `
CREATE TABLE IF NOT EXISTS batch_files (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES batches(id),
  file_kind TEXT NOT NULL,
  original_name TEXT NOT NULL,
  checksum TEXT,
  row_count INTEGER NOT NULL DEFAULT 0,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`,
  `
CREATE TABLE IF NOT EXISTS raw_ad_members (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES batches(id),
  group_name TEXT NOT NULL,
  ad_account TEXT NOT NULL,
  cn TEXT,
  mail TEXT,
  bu TEXT,
  bg TEXT
);
`,
  `
CREATE TABLE IF NOT EXISTS raw_users (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES batches(id),
  account TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  application TEXT,
  mail TEXT
);
`,
  `
CREATE TABLE IF NOT EXISTS raw_role_user (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES batches(id),
  role TEXT NOT NULL,
  user TEXT NOT NULL
);
`,
  `
CREATE TABLE IF NOT EXISTS raw_servers (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES batches(id),
  hostname TEXT NOT NULL,
  application_server_group TEXT NOT NULL,
  host_ip TEXT
);
`,
  `
CREATE TABLE IF NOT EXISTS mapping_row (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES batches(id),
  source_ad_member_row_id TEXT,
  ad_account TEXT NOT NULL,
  ad_name TEXT,
  first_name TEXT,
  last_name TEXT,
  mail TEXT,
  bg TEXT,
  bu TEXT,
  role_export TEXT,
  role_inferred TEXT,
  role_override TEXT,
  nb_hostname TEXT,
  group_owner TEXT,
  group_name TEXT,
  nas_folder_name TEXT,
  vm_hostname TEXT,
  host_ip TEXT,
  new_vm TEXT,
  user_roles TEXT,
  application TEXT,
  template_name TEXT,
  location TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`,
  `
CREATE INDEX IF NOT EXISTS idx_mapping_row_batch ON mapping_row(batch_id);
`,
  `
CREATE INDEX IF NOT EXISTS idx_mapping_row_ad_account ON mapping_row(ad_account);
`,
  `
CREATE INDEX IF NOT EXISTS idx_raw_ad_members_batch ON raw_ad_members(batch_id);
`,
];

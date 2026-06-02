import { randomUUID } from "node:crypto";

import type { PlatformDatabase } from "../db/database";
import { runInTransaction } from "../db/transaction";
import type { MappingRow } from "../export/types";
import { resolveMemberMail } from "../import/normalizeAccount";
import { isExcludedAdGroup } from "./excludedAdGroups";
import { inferRoleFromVmHostname } from "./inferRoleFromHostname";

const GROUP_OWNER_DEFAULT = "G-Delta-rollout_admin";

type JoinRow = {
  member_id: string;
  ad_account: string;
  cn: string;
  member_mail: string;
  bg: string;
  bu: string;
  group_name: string;
  first_name: string;
  last_name: string;
  application: string;
  user_role: string | null;
  vm_hostname: string | null;
  host_ip: string | null;
};

export function materializeMappingRows(db: PlatformDatabase, batchId: string): number {
  db.prepare(`DELETE FROM mapping_row WHERE batch_id = ?`).run(batchId);

  const rows = db
    .prepare(
      `
    SELECT
      m.id AS member_id,
      m.ad_account AS ad_account,
      m.cn AS cn,
      m.mail AS member_mail,
      m.bg AS bg,
      m.bu AS bu,
      m.group_name AS group_name,
      u.first_name AS first_name,
      u.last_name AS last_name,
      u.application AS application,
      ru.role AS user_role,
      s.hostname AS vm_hostname,
      s.host_ip AS host_ip
    FROM raw_ad_members m
    INNER JOIN raw_users u ON u.batch_id = m.batch_id AND u.account = m.ad_account
    LEFT JOIN raw_role_user ru ON ru.batch_id = m.batch_id AND ru.user = m.ad_account
    LEFT JOIN raw_servers s
      ON s.batch_id = m.batch_id
      AND s.application_server_group = ru.role
    WHERE m.batch_id = ?
    ORDER BY m.bg, m.ad_account, m.group_name, s.hostname
  `,
    )
    .all(batchId) as JoinRow[];

  const insert = db.prepare(`
    INSERT INTO mapping_row (
      id, batch_id, source_ad_member_row_id,
      ad_account, ad_name, first_name, last_name, mail, bg, bu,
      role_export, role_inferred, role_override,
      nb_hostname, group_owner, group_name, nas_folder_name,
      vm_hostname, host_ip, new_vm, user_roles, application,
      template_name, location
    ) VALUES (
      @id, @batch_id, @source_ad_member_row_id,
      @ad_account, @ad_name, @first_name, @last_name, @mail, @bg, @bu,
      @role_export, @role_inferred, @role_override,
      @nb_hostname, @group_owner, @group_name, @nas_folder_name,
      @vm_hostname, @host_ip, @new_vm, @user_roles, @application,
      @template_name, @location
    )
  `);

  let count = 0;
  runInTransaction(db, () => {
    for (const row of rows) {
      if (isExcludedAdGroup(row.group_name)) {
        continue;
      }

      const vmHostname = row.vm_hostname ?? "";
      const roleInferred = inferRoleFromVmHostname(vmHostname);
      const mapping: MappingRow = {
        id: randomUUID(),
        batch_id: batchId,
        source_ad_member_row_id: row.member_id,
        ad_account: row.ad_account,
        ad_name: row.cn ?? "",
        first_name: row.first_name ?? "",
        last_name: row.last_name ?? "",
        mail: resolveMemberMail(row.ad_account, row.member_mail),
        bg: row.bg ?? "",
        bu: row.bu ?? "",
        role_export: roleInferred,
        role_inferred: roleInferred,
        role_override: "",
        nb_hostname: "",
        group_owner: GROUP_OWNER_DEFAULT,
        group_name: row.group_name,
        nas_folder_name: "",
        vm_hostname: vmHostname,
        host_ip: row.host_ip ?? "",
        new_vm: "",
        user_roles: row.user_role ?? "",
        application: row.application ?? "",
        template_name: "",
        location: "",
      };

      insert.run(mapping);
      count += 1;
    }

    db.prepare(`UPDATE batches SET status = 'published', published_at = datetime('now') WHERE id = ?`).run(
      batchId,
    );
    db.prepare(`UPDATE batches SET status = 'archived' WHERE status = 'published' AND id != ?`).run(batchId);
  });

  return count;
}

export function loadMappingRows(db: PlatformDatabase, batchId: string): MappingRow[] {
  return db.prepare(`SELECT * FROM mapping_row WHERE batch_id = ?`).all(batchId) as MappingRow[];
}

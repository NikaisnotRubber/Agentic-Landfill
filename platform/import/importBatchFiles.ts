import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import type { PlatformDatabase } from "../db/database";
import { runInTransaction } from "../db/transaction";
import { parseCsvRecords } from "../../server/zentera/parseCsv";
import { normalizeAdAccount } from "./normalizeAccount";
import { expandRoleUsersFromCell } from "./expandRoleUsers";
import { parseAdGroupsXlsx } from "./parseAdGroupsXlsx";

export type BatchFileSet = {
  adGroupsXlsx: string;
  userRolesCsv: string;
  usersCsv: string;
  serverProfilesCsv: string;
};

function sha256File(content: Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

export async function importBatchFiles(
  db: PlatformDatabase,
  batchId: string,
  files: BatchFileSet,
): Promise<{ adMembers: number; users: number; roleUsers: number; servers: number }> {
  const insertMember = db.prepare(`
    INSERT INTO raw_ad_members (id, batch_id, group_name, ad_account, cn, mail, bu, bg)
    VALUES (@id, @batch_id, @group_name, @ad_account, @cn, @mail, @bu, @bg)
  `);

  const insertUser = db.prepare(`
    INSERT INTO raw_users (id, batch_id, account, first_name, last_name, application, mail)
    VALUES (@id, @batch_id, @account, @first_name, @last_name, @application, @mail)
  `);

  const insertRoleUser = db.prepare(`
    INSERT INTO raw_role_user (id, batch_id, role, user)
    VALUES (@id, @batch_id, @role, @user)
  `);

  const insertServer = db.prepare(`
    INSERT INTO raw_servers (id, batch_id, hostname, application_server_group, host_ip)
    VALUES (@id, @batch_id, @hostname, @application_server_group, @host_ip)
  `);

  const insertFile = db.prepare(`
    INSERT INTO batch_files (id, batch_id, file_kind, original_name, checksum, row_count)
    VALUES (@id, @batch_id, @file_kind, @original_name, @checksum, @row_count)
  `);

  runInTransaction(db, () => {
    db.prepare(`DELETE FROM raw_ad_members WHERE batch_id = ?`).run(batchId);
    db.prepare(`DELETE FROM raw_users WHERE batch_id = ?`).run(batchId);
    db.prepare(`DELETE FROM raw_role_user WHERE batch_id = ?`).run(batchId);
    db.prepare(`DELETE FROM raw_servers WHERE batch_id = ?`).run(batchId);
    db.prepare(`DELETE FROM batch_files WHERE batch_id = ?`).run(batchId);
  });

  const adMembers = await parseAdGroupsXlsx(files.adGroupsXlsx);
  for (const member of adMembers) {
    insertMember.run({
      id: randomUUID(),
      batch_id: batchId,
      group_name: member.groupName,
      ad_account: normalizeAdAccount(member.adAccount),
      cn: member.cn,
      mail: member.mail,
      bu: member.bu,
      bg: member.bg,
    });
  }

  const rolesText = await readFile(files.userRolesCsv, "utf8");
  const rolesRecords = parseCsvRecords(rolesText);
  let roleUserCount = 0;
  for (const record of rolesRecords) {
    const role = record.Role ?? "";
    const usersCell = record.User ?? record.Users ?? "";
    for (const pair of expandRoleUsersFromCell(usersCell, role)) {
      insertRoleUser.run({
        id: randomUUID(),
        batch_id: batchId,
        role: pair.role,
        user: normalizeAdAccount(pair.user),
      });
      roleUserCount += 1;
    }
  }

  const usersText = await readFile(files.usersCsv, "utf8");
  const usersRecords = parseCsvRecords(usersText);
  for (const record of usersRecords) {
    insertUser.run({
      id: randomUUID(),
      batch_id: batchId,
      account: normalizeAdAccount(record.Account ?? record.account ?? ""),
      first_name: record.FirstName ?? record["First Name"] ?? "",
      last_name: record.LastName ?? record["Last Name"] ?? "",
      application: record.Application ?? "",
      mail: (record.Mail ?? record.mail ?? "").toLowerCase(),
    });
  }

  const serversText = await readFile(files.serverProfilesCsv, "utf8");
  const serversRecords = parseCsvRecords(serversText);
  for (const record of serversRecords) {
    const hostname = record.Hostname ?? "";
    const appGroup = record["Application(Server Group)"] ?? "";
    if (!hostname || !appGroup) {
      continue;
    }
    insertServer.run({
      id: randomUUID(),
      batch_id: batchId,
      hostname: hostname.trim().toUpperCase(),
      application_server_group: appGroup.trim(),
      host_ip: (record["Host IP"] ?? "").trim(),
    });
  }

  const fileEntries: { kind: string; path: string; count: number }[] = [
    { kind: "ad_groups_xlsx", path: files.adGroupsXlsx, count: adMembers.length },
    { kind: "user_roles_csv", path: files.userRolesCsv, count: roleUserCount },
    { kind: "users_csv", path: files.usersCsv, count: usersRecords.length },
    { kind: "server_profiles_csv", path: files.serverProfilesCsv, count: serversRecords.length },
  ];

  for (const entry of fileEntries) {
    const buffer = await readFile(entry.path);
    insertFile.run({
      id: randomUUID(),
      batch_id: batchId,
      file_kind: entry.kind,
      original_name: path.basename(entry.path),
      checksum: sha256File(buffer),
      row_count: entry.count,
    });
  }

  db.prepare(`UPDATE batches SET status = 'uploaded' WHERE id = ?`).run(batchId);

  return {
    adMembers: adMembers.length,
    users: usersRecords.length,
    roleUsers: roleUserCount,
    servers: serversRecords.length,
  };
}

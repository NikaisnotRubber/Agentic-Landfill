import type { ProcessedDdpRow } from "../../server/ddp/types";
import type { PlatformDatabase } from "../db/database";
import { runInTransaction } from "../db/transaction";
import { ensureLiveTicketBatch } from "./ensureTicketBatch";
import { mapProcessedToMappingRow } from "./mapProcessedToMappingRow";

export type MappingUpsertSummary = {
  attempted: number;
  upserted: number;
  skipped: number;
};

export function shouldSyncTicketsToMappingDb(): boolean {
  const flag = process.env.PLATFORM_SYNC_TICKETS?.trim();
  if (flag === "0" || flag?.toLowerCase() === "false") {
    return false;
  }
  return true;
}

export function upsertMappingFromProcessedRows(
  db: PlatformDatabase,
  processedRows: ProcessedDdpRow[],
): MappingUpsertSummary {
  ensureLiveTicketBatch(db);

  const findExisting = db.prepare(`
    SELECT id FROM mapping_row
    WHERE source_kind = 'ticket'
      AND ad_account = @ad_account
      AND vm_hostname = @vm_hostname
      AND nb_hostname = @nb_hostname
  `);

  const insert = db.prepare(`
    INSERT INTO mapping_row (
      id, batch_id, source_kind, ticket_id, updated_at,
      ad_account, ad_name, first_name, last_name, mail, bg, bu,
      role_export, role_inferred, role_override,
      nb_hostname, group_owner, group_name, nas_folder_name,
      vm_hostname, host_ip, new_vm, user_roles, application,
      template_name, location
    ) VALUES (
      @id, @batch_id, 'ticket', @ticket_id, datetime('now'),
      @ad_account, @ad_name, @first_name, @last_name, @mail, @bg, @bu,
      @role_export, @role_inferred, @role_override,
      @nb_hostname, @group_owner, @group_name, @nas_folder_name,
      @vm_hostname, @host_ip, @new_vm, @user_roles, @application,
      @template_name, @location
    )
  `);

  const update = db.prepare(`
    UPDATE mapping_row SET
      ticket_id = @ticket_id,
      updated_at = datetime('now'),
      ad_name = @ad_name,
      first_name = @first_name,
      last_name = @last_name,
      mail = @mail,
      bu = @bu,
      role_export = @role_export,
      role_inferred = @role_inferred,
      nb_hostname = @nb_hostname,
      vm_hostname = @vm_hostname,
      user_roles = @user_roles,
      application = @application
    WHERE id = @id
  `);

  let attempted = 0;
  let upserted = 0;
  let skipped = 0;

  runInTransaction(db, () => {
    for (const processed of processedRows) {
      attempted += 1;
      const mapping = mapProcessedToMappingRow(processed);
      if (!mapping) {
        skipped += 1;
        continue;
      }

      const payload = {
        ...mapping,
        ticket_id: processed.ticketId,
      };

      const existing = findExisting.get({
        ad_account: mapping.ad_account,
        vm_hostname: mapping.vm_hostname,
        nb_hostname: mapping.nb_hostname,
      }) as { id: string } | undefined;

      if (existing) {
        update.run({
          id: existing.id,
          ticket_id: payload.ticket_id,
          ad_name: payload.ad_name,
          first_name: payload.first_name,
          last_name: payload.last_name,
          mail: payload.mail,
          bu: payload.bu,
          role_export: payload.role_export,
          role_inferred: payload.role_inferred,
          nb_hostname: payload.nb_hostname,
          vm_hostname: payload.vm_hostname,
          user_roles: payload.user_roles,
          application: payload.application,
        });
      } else {
        insert.run(payload);
      }
      upserted += 1;
    }
  });

  return { attempted, upserted, skipped };
}

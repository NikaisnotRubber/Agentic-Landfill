import type { MappingExportSchema } from "../contract/loadMappingExportSchema";
import { inferRoleFromVmHostname } from "../mapping/inferRoleFromHostname";
import type { ProcessedDdpRow } from "../../server/ddp/types";
import { emptyMappingRow, type MappingRow } from "./types";
import { serializeMappingCell } from "./serializeMappingRow";

const GROUP_OWNER_DEFAULT = "G-Delta-rollout_admin";

export function getTicketMappingColumns(schema: MappingExportSchema) {
  return schema.columns.filter((column) => column.inTicketWorkbook);
}

export function getDdpTicketWorkbookHeaders(schema: MappingExportSchema): string[] {
  const ticketOnly = schema.ticketOnlyColumns.map((column) => column.excelHeader);
  const mapping = getTicketMappingColumns(schema).map((column) => column.excelHeader);
  return [...ticketOnly, ...mapping];
}

export function processedDdpToMappingRow(
  processed: ProcessedDdpRow | undefined,
  options: { mail?: string } = {},
): MappingRow {
  const base = emptyMappingRow();

  if (!processed) {
    return base;
  }

  const vmHostname = processed.vmHostname ?? "";
  const roleFromTicket = processed.role?.trim() ?? "";
  const roleInferred = roleFromTicket ? "" : inferRoleFromVmHostname(vmHostname);

  return {
    ...base,
    ad_account: processed.adAccount ?? "",
    ad_name: processed.adName ?? "",
    first_name: processed.firstName ?? "",
    last_name: processed.lastName ?? "",
    mail: options.mail ?? processed.mail ?? "",
    bu: processed.bu ?? "",
    role_export: roleFromTicket,
    role_inferred: roleInferred,
    role_override: "",
    nb_hostname: processed.nbHostname ?? "",
    group_owner: GROUP_OWNER_DEFAULT,
    vm_hostname: vmHostname,
    user_roles: processed.userRoles ?? "",
    application: processed.application ?? "",
  };
}

export function serializeTicketMappingCells(
  processed: ProcessedDdpRow | undefined,
  schema: MappingExportSchema,
  options: { mail?: string } = {},
): string[] {
  const row = processedDdpToMappingRow(processed, options);
  return getTicketMappingColumns(schema).map((column) => serializeMappingCell(row, column));
}

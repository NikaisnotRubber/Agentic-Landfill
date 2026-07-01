import { randomUUID } from "node:crypto";

import type { ProcessedDdpRow } from "../../server/ddp/types";
import { normalizeAdAccount, resolveMemberMail } from "../import/normalizeAccount";
import { inferRoleFromVmHostname } from "../mapping/inferRoleFromHostname";
import type { MappingRow } from "../export/types";
import { LIVE_TICKET_BATCH_ID } from "./constants";

const GROUP_OWNER_DEFAULT = "G-Delta-rollout_admin";

export function mapProcessedToMappingRow(processed: ProcessedDdpRow): MappingRow | null {
  const adAccount = normalizeAdAccount(processed.adAccount ?? "");
  if (!adAccount) {
    return null;
  }

  const vmHostname = (processed.vmHostname ?? "").trim().toUpperCase();
  const nbHostname = (processed.nbHostname ?? "").trim();
  const roleInferred = inferRoleFromVmHostname(vmHostname);

  return {
    id: randomUUID(),
    batch_id: LIVE_TICKET_BATCH_ID,
    ad_account: adAccount,
    ad_name: processed.adName ?? "",
    first_name: processed.firstName ?? "",
    last_name: processed.lastName ?? "",
    mail: resolveMemberMail(adAccount, processed.mail ?? ""),
    bg: "",
    bu: processed.bu ?? "",
    role_export: processed.role?.trim() || roleInferred,
    role_inferred: roleInferred,
    role_override: "",
    nb_hostname: nbHostname,
    group_owner: GROUP_OWNER_DEFAULT,
    group_name: "",
    nas_folder_name: "",
    vm_hostname: vmHostname,
    host_ip: "",
    new_vm: "",
    user_roles: processed.userRoles ?? "",
    application: processed.application ?? "",
    template_name: "",
    location: "",
  };
}

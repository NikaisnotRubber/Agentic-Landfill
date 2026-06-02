import type { TicketRecord } from "../types";
import type { ZenteraIndexes } from "../zentera/types";
import { buildAbnormalFlags } from "./abnormalFlags";
import { extractHostnamesFromDescription } from "./extractHostnamesFromDescription";
import { resolveEffectiveAdAccount } from "./resolveEffectiveAdAccount";
import { applyDefaultMail, resolveProcessedIdentity } from "./resolveProcessedIdentity";
import { resolveVmHostname } from "./resolveVmHostname";
import type { ProcessedDdpRow } from "./types";
import { resolveZenteraExportFields } from "../zentera/resolveZenteraExportFields";

export type ParseDdpTicketOptions = {
  zentera?: ZenteraIndexes | null;
};

/** Applicant's direct manager (from LDAP enrich) for Zentera VM lookup. */
function readApplicantManagerAccount(ticket: TicketRecord): string {
  const ad = ticket.ad;
  if (!ad || ad.status !== "enriched") {
    return "";
  }
  return ad.managerAccount;
}

export function parseDdpTicket(
  ticket: TicketRecord,
  isNewTicket = false,
  options: ParseDdpTicketOptions = {},
): ProcessedDdpRow {
  const identity = applyDefaultMail(resolveProcessedIdentity(ticket));
  const effectiveAdAccount = resolveEffectiveAdAccount(ticket, identity);
  const hostnames = extractHostnamesFromDescription(ticket.short_description ?? "");
  const vm = resolveVmHostname({
    description: hostnames,
    managerAccount: readApplicantManagerAccount(ticket),
    zentera: options.zentera ?? null,
  });

  const abnormalFlags = buildAbnormalFlags({
    adAccount: effectiveAdAccount,
    nbHostname: hostnames.nbHostname,
    vmHostname: vm.vmHostname,
    hadInvalidVm: vm.hadInvalidVmFromDescription,
    hadMultipleZenteraVmCandidates: vm.hadMultipleZenteraCandidates,
  });

  const zenteraFields = resolveZenteraExportFields({
    vmHostname: vm.vmHostname,
    managerAccount: readApplicantManagerAccount(ticket),
    applicantAccount: identity.adAccount,
    zentera: options.zentera ?? null,
  });

  return {
    ticketId: ticket.id,
    status: ticket.status,
    subject: ticket.subject,
    requester: ticket.requester,
    isNewTicket,
    adAccount: identity.adAccount,
    adName: identity.adName,
    firstName: identity.firstName,
    lastName: identity.lastName,
    mail: identity.mail,
    bu: identity.bu,
    nbHostname: hostnames.nbHostname,
    vmHostname: vm.vmHostname,
    role: zenteraFields.role,
    application: zenteraFields.application,
    userRoles: zenteraFields.userRoles,
    abnormalFlags,
  };
}

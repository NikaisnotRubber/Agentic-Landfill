import type { TicketRecord } from "../types";
import type { ProcessedIdentity } from "./resolveProcessedIdentity";

/**
 * AD account used for abnormal checks — aligns processed row with enriched ticket.ad when present.
 */
export function resolveEffectiveAdAccount(
  ticket: TicketRecord,
  identity: ProcessedIdentity,
): string {
  if (identity.adAccount) {
    return identity.adAccount;
  }

  const adAccount = ticket.ad?.adAccount?.trim();
  if (adAccount) {
    return adAccount;
  }

  return "";
}

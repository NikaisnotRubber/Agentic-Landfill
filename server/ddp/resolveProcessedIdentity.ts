import type { TicketRecord } from "../types";
import { parseFirstLastFromAdName } from "./parseAdName";
import { resolveIdentityFromDescriptionAndRequester } from "./resolveIdentityFromDescriptionAndRequester";

export type ProcessedIdentity = {
  adAccount: string;
  adName: string;
  firstName: string;
  lastName: string;
  mail: string;
  bu: string;
};

function splitNameFromAdAccount(adAccount: string): { firstName: string; lastName: string } {
  if (!adAccount.includes(".")) {
    return { firstName: "", lastName: "" };
  }

  const parts = adAccount.split(".").filter(Boolean);
  if (parts.length < 2) {
    return { firstName: "", lastName: "" };
  }

  return {
    firstName: (parts[0] ?? "").trim(),
    lastName: (parts[parts.length - 1] ?? "").trim(),
  };
}

function resolveFirstLastName(adName: string, adAccount: string): {
  firstName: string;
  lastName: string;
} {
  const fromAdName = parseFirstLastFromAdName(adName);
  if (fromAdName.firstName || fromAdName.lastName) {
    return fromAdName;
  }

  return splitNameFromAdAccount(adAccount);
}

const EMPTY_IDENTITY: ProcessedIdentity = {
  adAccount: "",
  adName: "",
  firstName: "",
  lastName: "",
  mail: "",
  bu: "",
};

/**
 * Identity for Processed DDP rows:
 * 1. LDAP-enriched requester (`ticket.ad`) when available
 * 2. Otherwise description + requester merge (legacy Python rules)
 */
export function resolveProcessedIdentity(ticket: TicketRecord): ProcessedIdentity {
  const ad = ticket.ad;
  if (ad?.status === "enriched") {
    const nameParts = resolveFirstLastName(ad.displayName, ad.adAccount);
    return {
      adAccount: ad.adAccount,
      adName: ad.displayName,
      firstName: nameParts.firstName,
      lastName: nameParts.lastName,
      mail: ad.mail,
      bu: ad.bu,
    };
  }

  if (ad?.adAccount) {
    const nameParts = resolveFirstLastName("", ad.adAccount);
    return {
      adAccount: ad.adAccount,
      adName: "",
      firstName: nameParts.firstName,
      lastName: nameParts.lastName,
      mail: "",
      bu: "",
    };
  }

  return resolveIdentityFromDescriptionAndRequester(
    ticket.short_description ?? "",
    ticket.requester ?? "",
  );
}

export function applyDefaultMail(identity: ProcessedIdentity): ProcessedIdentity {
  if (identity.mail || !identity.adAccount) {
    return identity;
  }

  return {
    ...identity,
    mail: `${identity.adAccount}@deltaww.com`,
  };
}

import { extractIdentityFromDescription } from "./extractIdentityFromDescription";
import {
  parseRequesterIdentity,
  resolveFirstLastNameFromIdentity,
} from "./parseRequesterIdentity";
import type { ProcessedIdentity } from "./resolveProcessedIdentity";

/**
 * Python `extract_from_text` + requester overlay when requester AD matches description.
 * Used when LDAP enrichment is not available on the ticket.
 */
export function resolveIdentityFromDescriptionAndRequester(
  shortDescription: string,
  requester: string,
): ProcessedIdentity {
  const fromDesc = extractIdentityFromDescription(shortDescription);
  const fromRequester = parseRequesterIdentity(requester);

  let adAccount = fromDesc.adAccount;
  let adName = fromDesc.adName;
  let mail = fromDesc.mail || fromRequester.mail;

  const requesterAd = fromRequester.adAccount;
  if (requesterAd) {
    const descLower = shortDescription.toLowerCase();
    const requesterMatchesDescription =
      descLower.includes(requesterAd.toLowerCase()) ||
      fromDesc.adAccount.toLowerCase() === requesterAd.toLowerCase();

    if (requesterMatchesDescription) {
      adAccount = requesterAd;
      if (fromRequester.adName) {
        adName = fromRequester.adName;
      }
      if (fromRequester.mail) {
        mail = fromRequester.mail;
      }
    }
  }

  const nameParts = resolveFirstLastNameFromIdentity(adName, adAccount);

  return {
    adAccount,
    adName,
    firstName: nameParts.firstName,
    lastName: nameParts.lastName,
    mail,
    bu: "",
  };
}

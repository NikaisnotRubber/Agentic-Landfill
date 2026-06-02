import type { AdLookupClient } from "./ldapClient";
import { extractRequesterAccount } from "./requesterParser";
import type {
  TicketAdEnrichmentSummary,
  TicketAdInfo,
  TicketRecord,
} from "../types";

type EnrichmentResult = {
  tickets: TicketRecord[];
  summary: TicketAdEnrichmentSummary;
};

function emptyAdInfo(status: TicketAdInfo["status"], adAccount = "", error?: string): TicketAdInfo {
  return {
    status,
    adAccount,
    displayName: "",
    mail: "",
    department: "",
    manager: "",
    managerAccount: "",
    employeeId: "",
    bg: "",
    bu: "",
    ...(error ? { error } : {}),
  };
}

export async function enrichTicketsWithAd(
  tickets: TicketRecord[],
  client: AdLookupClient,
): Promise<EnrichmentResult> {
  const accountSet = new Set<string>();
  for (const ticket of tickets) {
    const account = extractRequesterAccount(ticket.requester);
    if (account) {
      accountSet.add(account);
    }
  }

  const lookupResults = new Map<
    string,
    | { kind: "enriched"; value: Awaited<ReturnType<AdLookupClient["lookupUser"]>> }
    | { kind: "not-found" }
    | { kind: "lookup-failed"; error: string }
  >();

  for (const account of accountSet) {
    try {
      const result = await client.lookupUser(account);
      if (result) {
        lookupResults.set(account, { kind: "enriched", value: result });
      } else {
        lookupResults.set(account, { kind: "not-found" });
      }
    } catch (error) {
      lookupResults.set(account, {
        kind: "lookup-failed",
        error: error instanceof Error ? error.message : "Lookup failed",
      });
    }
  }

  let enrichedCount = 0;
  let missingRequesterCount = 0;
  let notFoundCount = 0;
  let lookupFailedCount = 0;

  const enrichedTickets = tickets.map((ticket) => {
    const account = extractRequesterAccount(ticket.requester);
    if (!account) {
      missingRequesterCount += 1;
      return {
        ...ticket,
        ad: emptyAdInfo("missing-requester"),
      };
    }

    const lookup = lookupResults.get(account);
    if (!lookup || lookup.kind === "not-found") {
      notFoundCount += 1;
      return {
        ...ticket,
        ad: emptyAdInfo("not-found", account),
      };
    }

    if (lookup.kind === "lookup-failed") {
      lookupFailedCount += 1;
      return {
        ...ticket,
        ad: emptyAdInfo("lookup-failed", account, lookup.error),
      };
    }

    enrichedCount += 1;
    return {
      ...ticket,
      ad: {
        status: "enriched" as const,
        ...lookup.value,
      },
    };
  });

  return {
    tickets: enrichedTickets,
    summary: {
      totalTickets: tickets.length,
      uniqueAccounts: accountSet.size,
      enrichedCount,
      missingRequesterCount,
      notFoundCount,
      lookupFailedCount,
    },
  };
}

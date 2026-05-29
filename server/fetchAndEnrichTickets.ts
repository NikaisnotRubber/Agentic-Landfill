import { enrichTicketsWithAd as enrichTicketsWithAdImpl } from "./ad/enrichTicketsWithAd";
import { createAdLookupClient } from "./ad/ldapClient";
import { fetchTickets as fetchTicketsImpl } from "./fetchTickets";
import type {
  FetchTicketsOptions,
  TicketFetchResult,
  TicketFetchSuccess,
} from "./types";

type FetchAndEnrichDeps = {
  fetchTickets?: typeof fetchTicketsImpl;
  enrichTicketsWithAd?: typeof enrichTicketsWithAdImpl;
  createLookupClient?: typeof createAdLookupClient;
};

export async function fetchAndEnrichTickets(
  options: FetchTicketsOptions,
  deps: FetchAndEnrichDeps = {},
): Promise<TicketFetchResult> {
  const fetchTickets = deps.fetchTickets ?? fetchTicketsImpl;
  const enrichTicketsWithAd = deps.enrichTicketsWithAd ?? enrichTicketsWithAdImpl;
  const createLookupClient = deps.createLookupClient ?? createAdLookupClient;

  const fetched = await fetchTickets(options);
  if (!fetched.ok) {
    return fetched;
  }

  if (fetched.tickets.length === 0) {
    return fetched;
  }

  const lookupClient = createLookupClient();

  try {
    const enriched = await enrichTicketsWithAd(fetched.tickets, lookupClient);

    return {
      ...fetched,
      count: enriched.tickets.length,
      tickets: enriched.tickets,
      adSummary: enriched.summary,
    } satisfies TicketFetchSuccess;
  } catch (error) {
    return {
      ...fetched,
      adWarning: error instanceof Error ? error.message : "AD enrichment failed",
    } satisfies TicketFetchSuccess;
  } finally {
    try {
      await lookupClient.close();
    } catch {
      // Preserve the fetch/enrichment result even if LDAP client cleanup fails.
    }
  }
}

import { enrichTicketsWithAd as enrichTicketsWithAdImpl } from "./ad/enrichTicketsWithAd";
import { createAdLookupClient } from "./ad/ldapClient";
import {
  createDefaultTrackerDeps,
  detectNewTickets as detectNewTicketsImpl,
} from "./ddp/newTicketTracker";
import { processDdpTickets as processDdpTicketsImpl } from "./ddp/processDdpTickets";
import { fetchTickets as fetchTicketsImpl } from "./fetchTickets";
import type {
  FetchTicketsOptions,
  TicketFetchResult,
  TicketFetchSuccess,
} from "./types";

export type FetchProcessOptions = {
  persistTracker: boolean;
  enrich?: boolean;
};

type FetchProcessAndEnrichDeps = {
  fetchTickets?: typeof fetchTicketsImpl;
  detectNewTickets?: typeof detectNewTicketsImpl;
  processDdpTickets?: typeof processDdpTicketsImpl;
  enrichTicketsWithAd?: typeof enrichTicketsWithAdImpl;
  createLookupClient?: typeof createAdLookupClient;
  createTrackerDeps?: typeof createDefaultTrackerDeps;
};

export async function attachProcessedPayload(
  fetched: TicketFetchSuccess,
  options: FetchProcessOptions,
  deps: FetchProcessAndEnrichDeps = {},
): Promise<TicketFetchSuccess> {
  const detectNewTickets = deps.detectNewTickets ?? detectNewTicketsImpl;
  const processDdpTickets = deps.processDdpTickets ?? processDdpTicketsImpl;
  const createTrackerDeps = deps.createTrackerDeps ?? createDefaultTrackerDeps;

  let newTicketIds = new Set<string>();
  let trackerSummary: Parameters<typeof processDdpTickets>[2] = {};

  if (options.persistTracker && fetched.tickets.length > 0) {
    try {
      const detection = await detectNewTickets(
        fetched.tickets.map((ticket) => ({ id: ticket.id, subject: ticket.subject })),
        createTrackerDeps(),
      );
      newTicketIds = new Set(detection.newTicketIds);
      trackerSummary = detection.summary;
    } catch (error) {
      trackerSummary = {
        trackerWarning:
          error instanceof Error ? error.message : "New-ticket tracker failed",
      };
    }
  }

  const processed = processDdpTickets(fetched.tickets, newTicketIds, trackerSummary);

  return {
    ...fetched,
    processedRows: processed.rows,
    processedSummary: processed.summary,
  };
}

async function enrichFetchedTickets(
  fetched: TicketFetchSuccess,
  deps: FetchProcessAndEnrichDeps,
): Promise<TicketFetchSuccess> {
  const enrichTicketsWithAd = deps.enrichTicketsWithAd ?? enrichTicketsWithAdImpl;
  const createLookupClient = deps.createLookupClient ?? createAdLookupClient;
  const lookupClient = createLookupClient();

  try {
    const enriched = await enrichTicketsWithAd(fetched.tickets, lookupClient);
    return {
      ...fetched,
      count: enriched.tickets.length,
      tickets: enriched.tickets,
      adSummary: enriched.summary,
    };
  } catch (error) {
    return {
      ...fetched,
      adWarning: error instanceof Error ? error.message : "AD enrichment failed",
    };
  } finally {
    try {
      await lookupClient.close();
    } catch {
      // Preserve fetch/process/enrichment result even if LDAP cleanup fails.
    }
  }
}

export async function fetchProcessAndEnrich(
  options: FetchTicketsOptions,
  processOptions: FetchProcessOptions,
  deps: FetchProcessAndEnrichDeps = {},
): Promise<TicketFetchResult> {
  const fetchTickets = deps.fetchTickets ?? fetchTicketsImpl;

  const fetched = await fetchTickets(options);
  if (!fetched.ok) {
    return fetched;
  }

  let payload: TicketFetchSuccess = fetched;

  if (processOptions.enrich && payload.tickets.length > 0) {
    payload = await enrichFetchedTickets(payload, deps);
  }

  return attachProcessedPayload(payload, processOptions, deps);
}

export { rebuildProcessedPayload, mergeAdIntoProcessedRows } from "./ddp/rebuildProcessedPayload";

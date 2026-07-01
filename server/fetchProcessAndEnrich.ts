import { enrichTicketsWithAd as enrichTicketsWithAdImpl } from "./ad/enrichTicketsWithAd";
import { createAdLookupClient } from "./ad/ldapClient";
import {
  createDefaultTrackerDeps,
  detectNewTickets as detectNewTicketsImpl,
} from "./ddp/newTicketTracker";
import { processDdpTickets as processDdpTicketsImpl } from "./ddp/processDdpTickets";
import type { ProcessedDdpRow } from "./ddp/types";
import { fetchTickets as fetchTicketsImpl } from "./fetchTickets";
import { openMigratedPlatformDatabase } from "../platform/db/database";
import {
  shouldSyncTicketsToMappingDb,
  upsertMappingFromProcessedRows,
} from "../platform/sync/upsertMappingFromProcessed";
import type {
  FetchTicketsOptions,
  TicketFetchResult,
  TicketFetchSuccess,
  TicketRecord,
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

function mergeAdIntoProcessedRows(
  tickets: TicketRecord[],
  rows: ProcessedDdpRow[],
): ProcessedDdpRow[] {
  const ticketsById = new Map(tickets.map((ticket) => [ticket.id, ticket]));

  return rows.map((row) => {
    const ticket = ticketsById.get(row.ticketId);
    const ad = ticket?.ad;
    if (!ad || ad.status !== "enriched") {
      return row;
    }

    return {
      ...row,
      adAccount: ad.adAccount || row.adAccount,
      adName: ad.displayName || row.adName,
      mail: ad.mail || row.mail,
      bu: ad.bu || row.bu,
      abnormalFlags: row.abnormalFlags.filter((flag) => flag !== "missing-ad-account"),
    };
  });
}

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
  if (processed.rows.length > 0 && shouldSyncTicketsToMappingDb()) {
    const db = openMigratedPlatformDatabase();
    try {
      processed.summary.mappingSync = upsertMappingFromProcessedRows(db, processed.rows);
    } finally {
      db.close();
    }
  }

  return {
    ...fetched,
    processedRows: processed.rows,
    processedSummary: processed.summary,
  };
}

export async function fetchProcessAndEnrich(
  options: FetchTicketsOptions,
  processOptions: FetchProcessOptions,
  deps: FetchProcessAndEnrichDeps = {},
): Promise<TicketFetchResult> {
  const fetchTickets = deps.fetchTickets ?? fetchTicketsImpl;
  const enrichTicketsWithAd = deps.enrichTicketsWithAd ?? enrichTicketsWithAdImpl;
  const createLookupClient = deps.createLookupClient ?? createAdLookupClient;

  const fetched = await fetchTickets(options);
  if (!fetched.ok) {
    return fetched;
  }

  let result = await attachProcessedPayload(fetched, processOptions, deps);

  if (!processOptions.enrich || result.tickets.length === 0) {
    return result;
  }

  const lookupClient = createLookupClient();

  try {
    const enriched = await enrichTicketsWithAd(result.tickets, lookupClient);
    const processedRows = mergeAdIntoProcessedRows(enriched.tickets, result.processedRows ?? []);

    result = {
      ...result,
      count: enriched.tickets.length,
      tickets: enriched.tickets,
      adSummary: enriched.summary,
      processedRows,
    };
  } catch (error) {
    result = {
      ...result,
      adWarning: error instanceof Error ? error.message : "AD enrichment failed",
    };
  } finally {
    try {
      await lookupClient.close();
    } catch {
      // Preserve fetch/process/enrichment result even if LDAP cleanup fails.
    }
  }

  return result;
}

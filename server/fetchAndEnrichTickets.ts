import type { FetchTicketsOptions, TicketFetchResult } from "./types";
import { fetchProcessAndEnrich } from "./fetchProcessAndEnrich";

type FetchAndEnrichDeps = Parameters<typeof fetchProcessAndEnrich>[2];

export async function fetchAndEnrichTickets(
  options: FetchTicketsOptions,
  deps: FetchAndEnrichDeps = {},
): Promise<TicketFetchResult> {
  return fetchProcessAndEnrich(
    options,
    { persistTracker: true, enrich: true },
    deps,
  );
}

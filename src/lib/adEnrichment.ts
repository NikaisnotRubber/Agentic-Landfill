import type { ProcessedDdpRow, TicketFetchSuccess } from "./types";

export function canShowProcessedView(processedRows: ProcessedDdpRow[]): boolean {
  return processedRows.length > 0;
}

export function canFetchAndEnrichTickets(
  loading: boolean,
  enriching: boolean,
): boolean {
  return !loading && !enriching;
}

export function canEnrichCurrentTickets(
  result: TicketFetchSuccess | null,
  loading: boolean,
  enriching: boolean,
): boolean {
  return Boolean(result && result.tickets.length > 0 && !loading && !enriching);
}

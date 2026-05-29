import type { TicketFetchSuccess } from "./types";

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

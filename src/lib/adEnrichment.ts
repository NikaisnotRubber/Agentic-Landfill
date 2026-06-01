import type { ProcessedDdpRow, TicketFetchSuccess, TicketRecord } from "./types";

export function canShowProcessedView(processedRows: ProcessedDdpRow[]): boolean {
  return processedRows.length > 0;
}

export function mergeAdIntoProcessedRows(
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
    };
  });
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

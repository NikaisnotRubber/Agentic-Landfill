import type { ProcessedDdpRow, ProcessedDdpSummary } from "./types";
import { processDdpTickets } from "./processDdpTickets";
import type { TicketFetchSuccess, TicketRecord } from "../types";

type PreviousProcessed = Pick<TicketFetchSuccess, "processedRows" | "processedSummary">;

export function rebuildProcessedPayload(
  tickets: TicketRecord[],
  previous: PreviousProcessed = {},
): Pick<TicketFetchSuccess, "processedRows" | "processedSummary"> {
  const newTicketIds = new Set(
    (previous.processedRows ?? [])
      .filter((row) => row.isNewTicket)
      .map((row) => row.ticketId),
  );

  const trackerSummary: Pick<
    ProcessedDdpSummary,
    "latestSeenId" | "previousSeenId" | "trackerWarning"
  > = {};

  const summary = previous.processedSummary;
  if (summary?.latestSeenId) {
    trackerSummary.latestSeenId = summary.latestSeenId;
  }
  if (summary?.previousSeenId) {
    trackerSummary.previousSeenId = summary.previousSeenId;
  }
  if (summary?.trackerWarning) {
    trackerSummary.trackerWarning = summary.trackerWarning;
  }

  const processed = processDdpTickets(tickets, newTicketIds, trackerSummary);
  return {
    processedRows: processed.rows,
    processedSummary: processed.summary,
  };
}

export function mergeAdIntoProcessedRows(
  tickets: TicketRecord[],
  _rows: ProcessedDdpRow[],
): ProcessedDdpRow[] {
  return rebuildProcessedPayload(tickets, { processedRows: _rows }).processedRows ?? [];
}

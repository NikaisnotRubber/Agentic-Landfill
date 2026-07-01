import type { TicketRecord } from "../types";
import { parseDdpTicket } from "./parseDdpTicket";
import type { ProcessedDdpRow, ProcessedDdpSummary } from "./types";

export function processDdpTickets(
  tickets: TicketRecord[],
  newTicketIds: Set<string>,
  trackerSummary: Pick<
    ProcessedDdpSummary,
    "latestSeenId" | "previousSeenId" | "trackerWarning"
  > = {},
): { rows: ProcessedDdpRow[]; summary: ProcessedDdpSummary } {
  const rows = tickets.map((ticket) =>
    parseDdpTicket(ticket, newTicketIds.has(ticket.id)),
  );

  const abnormalRowCount = rows.filter((row) => row.abnormalFlags.length > 0).length;
  const newTicketCount = rows.filter((row) => row.isNewTicket).length;

  return {
    rows,
    summary: {
      totalRows: rows.length,
      abnormalRowCount,
      newTicketCount,
      ...trackerSummary,
    },
  };
}

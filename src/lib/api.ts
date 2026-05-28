import type { TicketFetchResult } from "./types";

export async function loadSampleTickets(): Promise<TicketFetchResult> {
  const response = await fetch("/api/tickets/sample");
  return response.json();
}

export async function loadLiveTickets(payload: {
  count: number;
  technician?: string;
  filterId?: string;
  stateFile?: string;
}): Promise<TicketFetchResult> {
  const response = await fetch("/api/tickets/fetch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  return response.json();
}

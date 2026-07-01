import type { TicketEnrichmentPayload, TicketFetchResult } from "./types";
import { requestJson } from "./http";

export async function loadSampleTickets(): Promise<TicketFetchResult> {
  return requestJson<TicketFetchResult>("/api/tickets/sample");
}

export async function loadLiveTickets(payload: {
  count: number;
  technician?: string;
  filterId?: string;
  stateFile?: string;
}): Promise<TicketFetchResult> {
  return requestJson<TicketFetchResult>("/api/tickets/fetch", { method: "POST", body: payload });
}

export async function fetchAndEnrichLiveTickets(payload: {
  count: number;
  technician?: string;
  filterId?: string;
  stateFile?: string;
}): Promise<TicketFetchResult> {
  return requestJson<TicketFetchResult>("/api/tickets/fetch-and-enrich", {
    method: "POST",
    body: payload,
  });
}

export async function enrichCurrentTickets(
  payload: TicketEnrichmentPayload,
): Promise<TicketFetchResult> {
  return requestJson<TicketFetchResult>("/api/tickets/enrich-ad", { method: "POST", body: payload });
}

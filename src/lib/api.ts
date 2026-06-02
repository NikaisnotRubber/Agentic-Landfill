import type {
  ProcessedDdpRow,
  TicketEnrichmentPayload,
  TicketFetchResult,
  TicketRecord,
} from "./types";

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

export async function fetchAndEnrichLiveTickets(payload: {
  count: number;
  technician?: string;
  filterId?: string;
  stateFile?: string;
}): Promise<TicketFetchResult> {
  const response = await fetch("/api/tickets/fetch-and-enrich", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  return response.json();
}

export async function enrichCurrentTickets(
  payload: TicketEnrichmentPayload,
): Promise<TicketFetchResult> {
  const response = await fetch("/api/tickets/enrich-ad", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  return response.json();
}

export async function exportTicketsExcel(payload: {
  tickets: TicketRecord[];
  processedRows?: ProcessedDdpRow[];
  filename?: string;
}): Promise<Blob> {
  const response = await fetch("/api/tickets/export-excel", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(errorBody?.error ?? `Excel export failed (${response.status})`);
  }

  return response.blob();
}

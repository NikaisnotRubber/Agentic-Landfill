export type TicketRecord = {
  id: string;
  subject: string;
  requester: string;
  technician: string;
  created_time: string;
  site: string;
  category: string;
  status: string;
  group: string;
  short_description: string;
  ad?: TicketAdInfo;
};

export type TicketAdInfo = {
  status: "enriched" | "missing-requester" | "not-found" | "lookup-failed";
  adAccount: string;
  displayName: string;
  mail: string;
  department: string;
  manager: string;
  employeeId: string;
  bg: string;
  bu: string;
  error?: string;
};

export type TicketAdEnrichmentSummary = {
  totalTickets: number;
  uniqueAccounts: number;
  enrichedCount: number;
  missingRequesterCount: number;
  notFoundCount: number;
  lookupFailedCount: number;
};

export type TicketFetchSuccess = {
  ok: true;
  source: "sample" | "live";
  count: number;
  tickets: TicketRecord[];
  raw?: unknown;
  adSummary?: TicketAdEnrichmentSummary;
};

export type TicketFetchFailure = {
  ok: false;
  source?: "sample" | "live";
  error: string;
  details?: unknown;
};

export type TicketFetchResult = TicketFetchSuccess | TicketFetchFailure;

export type TicketEnrichmentPayload = {
  source: TicketFetchSuccess["source"];
  tickets: TicketRecord[];
};

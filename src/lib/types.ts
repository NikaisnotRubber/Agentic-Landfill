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
};

export type TicketFetchSuccess = {
  ok: true;
  source: "sample" | "live";
  count: number;
  tickets: TicketRecord[];
  raw?: unknown;
};

export type TicketFetchFailure = {
  ok: false;
  source?: "sample" | "live";
  error: string;
  details?: unknown;
};

export type TicketFetchResult = TicketFetchSuccess | TicketFetchFailure;

import type { TicketRecord } from "./types";

export const HELPDESK_BASE_URL = "https://ithelpdesk.deltaww.com/WOListView.do";
export const HELPDESK_API_ORIGIN = "https://ithelpdesk.deltaww.com";
export const DEFAULT_FILTER_ID = "2130";

export const TARGET_FIELDS = [
  "short_description",
  "subject",
  "id",
  "group",
  "requester",
  "technician",
  "created_time",
  "site",
  "category",
  "status",
] as const;

type BuildHelpdeskApiUrlOptions = {
  count: number;
  filterId?: string;
  fields?: readonly string[];
};

export function buildHelpdeskApiUrl(
  options: BuildHelpdeskApiUrlOptions,
): string {
  const inputData = {
    list_info: {
      filter_by: {
        id: options.filterId ?? DEFAULT_FILTER_ID,
      },
      start_index: 1,
      sort_field: "created_time",
      sort_order: "desc",
      row_count: options.count,
      fields_required: [...(options.fields ?? TARGET_FIELDS)],
      get_total_count: true,
    },
    for: "list_view_filter",
  };

  const url = new URL("/api/v3/requests", HELPDESK_API_ORIGIN);
  url.searchParams.set("input_data", JSON.stringify(inputData));
  url.searchParams.set("SUBREQUEST", "XMLHTTP");
  return url.toString();
}

export function isHelpdeskAuthFailure(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const responseStatus = (payload as { response_status?: unknown }).response_status;
  const messages = Array.isArray(responseStatus)
    ? responseStatus
    : responseStatus &&
        typeof responseStatus === "object" &&
        Array.isArray((responseStatus as { messages?: unknown[] }).messages)
      ? (responseStatus as { messages: unknown[] }).messages
      : [];

  return messages.some((message) => {
    if (!message || typeof message !== "object") {
      return false;
    }
    return (message as { status_code?: unknown }).status_code === 401;
  });
}

export function cleanTicketRecords(rawRequests: unknown[]): TicketRecord[] {
  return rawRequests.map((request) => {
    const row = (request ?? {}) as Record<string, unknown>;

    return {
      id: normalizeValue(row.id),
      subject: normalizeValue(row.subject),
      requester: normalizeValue(row.requester),
      technician: normalizeValue(row.technician),
      created_time: normalizeValue(row.created_time),
      site: normalizeValue(row.site),
      category: normalizeValue(row.category),
      status: normalizeValue(row.status),
      group: normalizeValue(row.group),
      short_description: normalizeValue(row.short_description),
    };
  });
}

export function normalizeValue(value: unknown): string {
  if (value == null) {
    return "";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.name === "string") {
      return record.name;
    }
    if (typeof record.display_value === "string") {
      return record.display_value;
    }
    if (typeof record.value === "string") {
      return record.value;
    }
  }

  return JSON.stringify(value);
}

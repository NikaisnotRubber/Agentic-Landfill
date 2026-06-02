import type { IncomingMessage, ServerResponse } from "node:http";

import { rebuildProcessedPayload } from "../ddp/rebuildProcessedPayload";
import { readBody, sendJson } from "../http";
import type { TicketEnrichmentPayload, TicketFetchFailure, TicketFetchSuccess } from "../types";
import { createAdLookupClient } from "./ldapClient";
import { enrichTicketsWithAd } from "./enrichTicketsWithAd";

type ReadBody = (request: IncomingMessage) => Promise<string>;
type CreateLookupClient = typeof createAdLookupClient;

type HandlerDeps = {
  readBody?: ReadBody;
  createLookupClient?: CreateLookupClient;
};

function isTicketPayload(value: unknown): value is TicketEnrichmentPayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Record<string, unknown>;
  return (
    (payload.source === "sample" || payload.source === "live") &&
    Array.isArray(payload.tickets)
  );
}

export function createEnrichAdHandler(deps: HandlerDeps = {}) {
  const readRequestBody = deps.readBody ?? readBody;
  const createLookupClient = deps.createLookupClient ?? createAdLookupClient;

  return async function handleEnrichAdRequest(
    request: IncomingMessage,
    response: ServerResponse,
  ) {
    if (request.method !== "POST") {
      sendJson(response, { ok: false, error: "Method not allowed" }, 405);
      return;
    }

    let lookupClient:
      | ReturnType<CreateLookupClient>
      | undefined;

    try {
      const body = await readRequestBody(request);
      const parsed = body ? JSON.parse(body) : {};
      if (!isTicketPayload(parsed)) {
        sendJson(response, { ok: false, error: "Malformed enrichment payload" }, 400);
        return;
      }

      lookupClient = createLookupClient();
      const result = await enrichTicketsWithAd(parsed.tickets, lookupClient);
      const reprocessed = rebuildProcessedPayload(result.tickets, {
        processedRows: parsed.processedRows,
        processedSummary: parsed.processedSummary,
      });
      const payload: TicketFetchSuccess = {
        ok: true,
        source: parsed.source,
        count: result.tickets.length,
        tickets: result.tickets,
        adSummary: result.summary,
        processedRows: reprocessed.processedRows,
        processedSummary: reprocessed.processedSummary,
      };

      sendJson(response, payload, 200);
    } catch (error) {
      const payload: TicketFetchFailure = {
        ok: false,
        source: "live",
        error: error instanceof Error ? error.message : "AD enrichment request failed",
      };
      sendJson(response, payload, 500);
    } finally {
      if (lookupClient) {
        await lookupClient.close();
      }
    }
  };
}

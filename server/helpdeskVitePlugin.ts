import type { Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";

import { createEnrichAdHandler } from "./ad/enrichAdRoute";
import { handleExportDdpExcel } from "./excel/exportDdpExcelRoute";
import { fetchAndEnrichTickets } from "./fetchAndEnrichTickets";
import { attachProcessedPayload, fetchProcessAndEnrich } from "./fetchProcessAndEnrich";
import { isHelpdeskAuthFailure } from "./helpdeskApi";
import { readBody, sendJson } from "./http";
import { registerPlatformMappingRoutes } from "./platformMappingApiPlugin";
import { readSampleTickets } from "./sampleTickets";
import type { TicketFetchFailure } from "./types";

function getTicketFailureStatus(result: TicketFetchFailure): number {
  return isHelpdeskAuthFailure(result.details) ? 401 : 500;
}

export function helpdeskTicketApiPlugin(): Plugin {
  return {
    name: "helpdesk-ticket-api",
    configureServer(server) {
      server.middlewares.use("/api/tickets/sample", async (_request, response) => {
        try {
          const sample = await readSampleTickets();
          const result = await attachProcessedPayload(sample, { persistTracker: false });
          sendJson(response, result);
        } catch (error) {
          sendJson(
            response,
            {
              ok: false,
              source: "sample",
              error: error instanceof Error ? error.message : "Failed to load sample tickets",
            },
            500,
          );
        }
      });

      server.middlewares.use("/api/tickets/fetch", async (request, response) => {
        if (request.method !== "POST") {
          sendJson(response, { ok: false, error: "Method not allowed" }, 405);
          return;
        }

        try {
          const body = await readBody(request);
          const payload = body ? JSON.parse(body) : {};
          const result = await fetchProcessAndEnrich(
            {
              count: Number(payload.count ?? 25),
              technician: payload.technician || undefined,
              filterId: payload.filterId || undefined,
              stateFile: payload.stateFile || undefined,
            },
            { persistTracker: true, enrich: false },
          );

          sendJson(response, result, result.ok ? 200 : 401);
        } catch (error) {
          sendJson(
            response,
            { ok: false, error: error instanceof Error ? error.message : "Request failed" },
            500,
          );
        }
      });

      server.middlewares.use("/api/tickets/fetch-and-enrich", async (request, response) => {
        if (request.method !== "POST") {
          sendJson(response, { ok: false, error: "Method not allowed" }, 405);
          return;
        }

        try {
          const body = await readBody(request);
          const payload = body ? JSON.parse(body) : {};
          const result = await fetchAndEnrichTickets({
            count: Number(payload.count ?? 25),
            technician: payload.technician || undefined,
            filterId: payload.filterId || undefined,
            stateFile: payload.stateFile || undefined,
          });

          sendJson(response, result, result.ok ? 200 : getTicketFailureStatus(result));
        } catch (error) {
          sendJson(
            response,
            { ok: false, error: error instanceof Error ? error.message : "Request failed" },
            500,
          );
        }
      });

      server.middlewares.use("/api/tickets/enrich-ad", createEnrichAdHandler());

      server.middlewares.use("/api/tickets/export-excel", async (request, response) => {
        await handleExportDdpExcel(request, response);
      });

      registerPlatformMappingRoutes(server.middlewares);
    },
  };
}

/** Test helper: register routes on a connect-style middleware stack. */
export function registerHelpdeskTicketRoutes(middlewares: {
  use: (path: string, handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>) => void;
}): void {
  const plugin = helpdeskTicketApiPlugin();
  plugin.configureServer!({ middlewares } as never);
}

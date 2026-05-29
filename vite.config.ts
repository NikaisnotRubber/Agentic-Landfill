import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

import { fetchAndEnrichTickets } from "./server/fetchAndEnrichTickets";
import { fetchTickets } from "./server/fetchTickets";
import { createEnrichAdHandler } from "./server/ad/enrichAdRoute";
import { isHelpdeskAuthFailure } from "./server/helpdeskApi";
import { readBody, sendJson } from "./server/http";
import { readSampleTickets } from "./server/sampleTickets";
import type { TicketFetchFailure } from "./server/types";

function getTicketFailureStatus(result: TicketFetchFailure): number {
  return isHelpdeskAuthFailure(result.details) ? 401 : 500;
}

export default defineConfig({
  plugins: [
    vue(),
    {
      name: "helpdesk-ticket-api",
      configureServer(server) {
        server.middlewares.use("/api/tickets/sample", async (_request, response) => {
          try {
            const result = await readSampleTickets();
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
            const result = await fetchTickets({
              count: Number(payload.count ?? 25),
              technician: payload.technician || undefined,
              filterId: payload.filterId || undefined,
              stateFile: payload.stateFile || undefined,
            });

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
      },
    },
  ],
});

import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

import { fetchTickets } from "./server/fetchTickets";
import { createEnrichAdHandler } from "./server/ad/enrichAdRoute";
import { readBody, sendJson } from "./server/http";
import { readSampleTickets } from "./server/sampleTickets";

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

        server.middlewares.use("/api/tickets/enrich-ad", createEnrichAdHandler());
      },
    },
  ],
});

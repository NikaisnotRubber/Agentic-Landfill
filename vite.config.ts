import type { IncomingMessage, ServerResponse } from "node:http";

import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

import { fetchTickets } from "./server/fetchTickets";
import { readSampleTickets } from "./server/sampleTickets";

function sendJson(response: ServerResponse, payload: unknown, statusCode = 200) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
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
      },
    },
  ],
});

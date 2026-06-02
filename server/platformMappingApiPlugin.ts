import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

import {
  getPublishedBatchMetadata,
  listMappingBatches,
  queryPublishedMappingRows,
} from "../platform/api/publishedMappingService";
import { openMigratedPlatformDatabase } from "../platform/db/database";
import { sendJson } from "./http";

function parseQuery(request: IncomingMessage): URLSearchParams {
  const url = new URL(request.url ?? "/", "http://localhost");
  return url.searchParams;
}

export function platformMappingApiPlugin(): Plugin {
  return {
    name: "platform-mapping-api",
    configureServer() {
      // Routes registered via registerPlatformMappingRoutes for test parity.
    },
  };
}

export function registerPlatformMappingRoutes(middlewares: {
  use: (path: string, handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>) => void;
}): void {
  middlewares.use("/api/platform/mapping/published", async (request, response) => {
    if (request.method !== "GET") {
      sendJson(response, { ok: false, error: "Method not allowed" }, 405);
      return;
    }

    try {
      const db = openMigratedPlatformDatabase();
      const metadata = getPublishedBatchMetadata(db);
      if (!metadata) {
        sendJson(response, { ok: false, error: "No published mapping batch" }, 404);
        return;
      }
      sendJson(response, { ok: true, ...metadata });
    } catch (error) {
      sendJson(
        response,
        { ok: false, error: error instanceof Error ? error.message : "Request failed" },
        500,
      );
    }
  });

  middlewares.use("/api/platform/mapping/batches", async (request, response) => {
    if (request.method !== "GET") {
      sendJson(response, { ok: false, error: "Method not allowed" }, 405);
      return;
    }

    try {
      const query = parseQuery(request);
      const limit = Number(query.get("limit") ?? 20);
      const db = openMigratedPlatformDatabase();
      const batches = listMappingBatches(db, limit);
      sendJson(response, { ok: true, batches });
    } catch (error) {
      sendJson(
        response,
        { ok: false, error: error instanceof Error ? error.message : "Request failed" },
        500,
      );
    }
  });

  middlewares.use("/api/platform/mapping/rows", async (request, response) => {
    if (request.method !== "GET") {
      sendJson(response, { ok: false, error: "Method not allowed" }, 405);
      return;
    }

    try {
      const query = parseQuery(request);
      const db = openMigratedPlatformDatabase();
      const result = await queryPublishedMappingRows(db, {
        adAccount: query.get("adAccount") ?? undefined,
        limit: Number(query.get("limit") ?? 50),
        offset: Number(query.get("offset") ?? 0),
      });

      if (!result) {
        sendJson(response, { ok: false, error: "No published mapping batch" }, 404);
        return;
      }

      sendJson(response, { ok: true, ...result });
    } catch (error) {
      sendJson(
        response,
        { ok: false, error: error instanceof Error ? error.message : "Request failed" },
        500,
      );
    }
  });
}

import type { IncomingMessage, ServerResponse } from "node:http";
import { readBody as readBodyImpl, sendJson } from "../http";
import { syncHelpdeskVmMaster as syncHelpdeskVmMasterImpl } from "./helpdeskSync";
import type { HelpdeskVmSyncOptions, HelpdeskVmSyncResult } from "./types";

type Deps = {
  readBody?: typeof readBodyImpl;
  syncHelpdeskVmMaster?: (options: HelpdeskVmSyncOptions) => Promise<HelpdeskVmSyncResult>;
};

function parseOptions(payload: Record<string, unknown>): HelpdeskVmSyncOptions {
  const count = Number(payload.count ?? 25);
  if (!Number.isFinite(count) || count <= 0) {
    throw new Error("count must be a positive number");
  }

  return {
    count,
    technician:
      typeof payload.technician === "string" && payload.technician
        ? payload.technician
        : undefined,
    filterId:
      typeof payload.filterId === "string" && payload.filterId ? payload.filterId : undefined,
    stateFile:
      typeof payload.stateFile === "string" && payload.stateFile ? payload.stateFile : undefined,
    ddpOnly: typeof payload.ddpOnly === "boolean" ? payload.ddpOnly : undefined,
  };
}

export function createVmMasterSyncHelpdeskHandler(deps: Deps = {}) {
  const readBody = deps.readBody ?? readBodyImpl;
  const syncHelpdeskVmMaster = deps.syncHelpdeskVmMaster ?? syncHelpdeskVmMasterImpl;

  return async (request: IncomingMessage, response: ServerResponse) => {
    if (request.method !== "POST") {
      sendJson(response, { ok: false, error: "Method not allowed" }, 405);
      return;
    }

    try {
      const body = await readBody(request);
      const payload = body ? JSON.parse(body) : {};
      const options = parseOptions(payload);
      const result = await syncHelpdeskVmMaster(options);
      sendJson(response, result, result.ok ? 200 : 500);
    } catch (error) {
      sendJson(
        response,
        { ok: false, error: error instanceof Error ? error.message : "Request failed" },
        400,
      );
    }
  };
}

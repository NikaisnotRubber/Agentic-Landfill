import type { IncomingMessage, ServerResponse } from "node:http";
import { sendJson } from "../http";
import { listHelpdeskVmSyncLogs, readHelpdeskVmSyncLog } from "./syncLog";
import type { HelpdeskVmSyncLogEntry, HelpdeskVmSyncLogListItem } from "./types";

type Deps = {
  listLogs?: () => Promise<HelpdeskVmSyncLogListItem[]>;
  readLog?: (id: string) => Promise<HelpdeskVmSyncLogEntry>;
};

function getPathname(request: IncomingMessage): string {
  return new URL(request.url ?? "/", "http://localhost").pathname;
}

function getLogIdFromRequest(request: IncomingMessage): string {
  return decodeURIComponent(getPathname(request).replace(/^\/+/, ""));
}

export function createVmMasterSyncLogHandler(deps: Deps = {}) {
  const listLogs = deps.listLogs ?? listHelpdeskVmSyncLogs;
  const readLog = deps.readLog ?? readHelpdeskVmSyncLog;

  return async (request: IncomingMessage, response: ServerResponse) => {
    if (request.method !== "GET") {
      sendJson(response, { ok: false, error: "Method not allowed" }, 405);
      return;
    }

    try {
      const logId = getLogIdFromRequest(request);
      if (!logId) {
        sendJson(response, { ok: true, logs: await listLogs() });
        return;
      }

      sendJson(response, { ok: true, log: await readLog(logId) });
    } catch (error) {
      sendJson(
        response,
        { ok: false, error: error instanceof Error ? error.message : "Sync log request failed" },
        500,
      );
    }
  };
}

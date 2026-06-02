import type { IncomingMessage, ServerResponse } from "node:http";

import { readBody } from "../http";
import type { ProcessedDdpRow } from "../ddp/types";
import type { TicketRecord } from "../types";
import { DDP_EXCEL_DEFAULT_FILENAME } from "./ddpExcelColumns";
import { exportDdpExcelToBuffer } from "./exportDdpExcel";

type ExportPayload = {
  tickets?: TicketRecord[];
  processedRows?: ProcessedDdpRow[];
  filename?: string;
};

export async function handleExportDdpExcel(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  if (request.method !== "POST") {
    response.statusCode = 405;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(JSON.stringify({ ok: false, error: "Method not allowed" }));
    return;
  }

  try {
    const body = await readBody(request);
    const payload = (body ? JSON.parse(body) : {}) as ExportPayload;
    const tickets = Array.isArray(payload.tickets) ? payload.tickets : [];
    const processedRows = Array.isArray(payload.processedRows) ? payload.processedRows : [];

    if (tickets.length === 0) {
      response.statusCode = 400;
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.end(JSON.stringify({ ok: false, error: "No tickets to export" }));
      return;
    }

    const result = await exportDdpExcelToBuffer({ tickets, processedRows });
    const filename = payload.filename?.trim() || DDP_EXCEL_DEFAULT_FILENAME;

    response.statusCode = 200;
    response.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    response.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    response.setHeader("X-Pending-Count", String(result.pendingCount));
    response.setHeader("X-Closed-Count", String(result.closedCount));
    response.setHeader("X-Total-Count", String(result.totalCount));
    response.end(result.buffer);
  } catch (error) {
    response.statusCode = 500;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : "Excel export failed",
      }),
    );
  }
}

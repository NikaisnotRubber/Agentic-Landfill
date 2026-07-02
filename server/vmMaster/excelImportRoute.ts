import type { IncomingMessage, ServerResponse } from "node:http";

import { createAdLookupClient } from "../ad/ldapClient";
import { applyVmMasterSchema, openVmMasterDatabase, type VmMasterDatabase } from "../db/sqlite";
import { readBody as readBodyImpl, sendJson } from "../http";
import {
  executeVmMasterExcelImport,
  parseVmMasterExcelPreview,
  type VmMasterExcelImportInput,
} from "./excelImport";

type PreviewDeps = {
  readBody?: typeof readBodyImpl;
  previewWorkbook?: typeof parseVmMasterExcelPreview;
};

type ExecuteDeps = {
  readBody?: typeof readBodyImpl;
  executeImport?: typeof executeVmMasterExcelImport;
};

function malformedMessage(error: unknown, fallback: string): string {
  return error instanceof SyntaxError ? "Malformed VM Master Excel import payload" : error instanceof Error ? error.message : fallback;
}

function parseWorkbookPayload(body: string): Omit<VmMasterExcelImportInput, "mapping"> {
  const payload = JSON.parse(body) as Record<string, unknown>;
  if (typeof payload.fileName !== "string" || typeof payload.workbookBase64 !== "string") {
    throw new Error("VM Master Excel import requires fileName and workbookBase64");
  }

  return {
    fileName: payload.fileName,
    workbookBuffer: Buffer.from(payload.workbookBase64, "base64"),
    changedBy: typeof payload.changedBy === "string" ? payload.changedBy : undefined,
  };
}

export function createVmMasterExcelImportPreviewHandler(deps: PreviewDeps = {}) {
  const readBody = deps.readBody ?? readBodyImpl;
  const previewWorkbook = deps.previewWorkbook ?? parseVmMasterExcelPreview;

  return async (request: IncomingMessage, response: ServerResponse) => {
    if (request.method !== "POST") {
      sendJson(response, { ok: false, error: "Method not allowed" }, 405);
      return;
    }

    try {
      const payload = parseWorkbookPayload(await readBody(request));
      const preview = await previewWorkbook(payload);
      sendJson(response, { ok: true, ...preview });
    } catch (error) {
      sendJson(response, { ok: false, error: malformedMessage(error, "Excel import preview failed") }, 400);
    }
  };
}

export function createVmMasterExcelImportExecuteHandler(deps: ExecuteDeps = {}) {
  const readBody = deps.readBody ?? readBodyImpl;
  const executeImport = deps.executeImport ?? executeVmMasterExcelImport;

  return async (request: IncomingMessage, response: ServerResponse) => {
    if (request.method !== "POST") {
      sendJson(response, { ok: false, error: "Method not allowed" }, 405);
      return;
    }

    let database: VmMasterDatabase | undefined;
    try {
      const body = await readBody(request);
      const parsed = JSON.parse(body) as Record<string, unknown>;
      const payload = parseWorkbookPayload(body);
      database = openVmMasterDatabase();
      applyVmMasterSchema(database);
      const result = await executeImport(
        { ...payload, mapping: (parsed.mapping ?? {}) as Record<string, unknown> },
        { database, createLookupClient: createAdLookupClient },
      );
      sendJson(response, result, result.ok ? 200 : 500);
    } catch (error) {
      sendJson(response, { ok: false, error: malformedMessage(error, "Excel import execute failed") }, 400);
    } finally {
      database?.close();
    }
  };
}
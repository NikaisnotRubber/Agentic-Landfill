import type { IncomingMessage, ServerResponse } from "node:http";
import { applyVmMasterSchema, openVmMasterDatabase } from "../db/sqlite";
import { readBody as readBodyImpl, sendJson } from "../http";
import {
  executeVmMasterManualEditCommand,
  parseVmMasterManualEditCommand,
} from "./repository";
import type { VmMasterManualEditCommand, VmMasterManualEditCommandResult } from "./types";

type ManualEditCommandRepository = {
  execute(payload: VmMasterManualEditCommand): VmMasterManualEditCommandResult;
};

type HandlerDeps = {
  readBody?: typeof readBodyImpl;
};

function createManualEditCommandRepository(): ManualEditCommandRepository {
  return {
    execute: (payload) => {
      const database = openVmMasterDatabase();

      try {
        applyVmMasterSchema(database);
        return executeVmMasterManualEditCommand(database, payload);
      } finally {
        database.close();
      }
    },
  };
}

export function createVmMasterManualEditCommandHandler(
  repository: ManualEditCommandRepository = createManualEditCommandRepository(),
  deps: HandlerDeps = {},
) {
  const readBody = deps.readBody ?? readBodyImpl;

  return async (request: IncomingMessage, response: ServerResponse) => {
    if (request.method !== "POST") {
      sendJson(response, { ok: false, error: "Method not allowed" }, 405);
      return;
    }

    try {
      const body = await readBody(request);
      const payload = parseVmMasterManualEditCommand(body ? JSON.parse(body) : {});
      const result = repository.execute(payload);
      sendJson(response, { ok: true, ...result });
    } catch (error) {
      sendJson(
        response,
        {
          ok: false,
          error:
            error instanceof SyntaxError
              ? "Malformed VM Master manual edit command payload"
              : error instanceof Error
                ? error.message
                : "Failed to execute VM Master manual edit command",
        },
        400,
      );
    }
  };
}
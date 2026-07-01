import type { IncomingMessage, ServerResponse } from "node:http";
import { applyVmMasterSchema, openVmMasterDatabase } from "../db/sqlite";
import { sendJson } from "../http";
import { listVmMasterPreviewGroups } from "./repository";
import type { VmMasterBgGroup } from "./types";

export type VmMasterPreviewRepository = {
  listPreviewGroups(): VmMasterBgGroup[];
};

export function createVmMasterPreviewRepository(): VmMasterPreviewRepository {
  return {
    listPreviewGroups: () => {
      const database = openVmMasterDatabase();

      try {
        applyVmMasterSchema(database);
        return listVmMasterPreviewGroups(database);
      } finally {
        database.close();
      }
    },
  };
}

export function createVmMasterPreviewHandler(
  repository: VmMasterPreviewRepository = createVmMasterPreviewRepository(),
) {
  return (request: IncomingMessage, response: ServerResponse) => {
    if (request.method !== "GET") {
      sendJson(response, { ok: false, error: "Method not allowed" }, 405);
      return;
    }

    try {
      const groups = repository.listPreviewGroups();
      sendJson(response, { ok: true, groups });
    } catch (error) {
      sendJson(
        response,
        {
          ok: false,
          error: error instanceof Error ? error.message : "Failed to load VM master preview",
        },
        500,
      );
    }
  };
}
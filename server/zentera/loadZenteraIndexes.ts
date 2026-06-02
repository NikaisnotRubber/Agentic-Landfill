import { readFileSync } from "node:fs";

import { buildZenteraIndexesFromCsv } from "./buildZenteraIndexes";
import { resolveZenteraDataPaths } from "./defaultZenteraPaths";
import type { ZenteraIndexes } from "./types";

let cachedIndexes: ZenteraIndexes | null | undefined;

export function resetZenteraIndexCache(): void {
  cachedIndexes = undefined;
}

export function loadZenteraIndexes(options: {
  dataDir?: string;
  userRolesPath?: string;
  serverProfilesPath?: string;
} = {}): ZenteraIndexes {
  const paths = resolveZenteraDataPaths(options.dataDir);
  const userRolesPath = options.userRolesPath ?? paths.userRolesPath;
  const serverProfilesPath = options.serverProfilesPath ?? paths.serverProfilesPath;

  return buildZenteraIndexesFromCsv({
    userRolesCsv: readFileSync(userRolesPath, "utf8"),
    serverProfilesCsv: readFileSync(serverProfilesPath, "utf8"),
  });
}

/** Returns cached indexes, or null when files are missing (Processed view still works). */
export function tryLoadZenteraIndexes(options: {
  dataDir?: string;
  userRolesPath?: string;
  serverProfilesPath?: string;
} = {}): ZenteraIndexes | null {
  if (cachedIndexes !== undefined) {
    return cachedIndexes;
  }

  try {
    cachedIndexes = loadZenteraIndexes(options);
  } catch {
    cachedIndexes = null;
  }

  return cachedIndexes;
}

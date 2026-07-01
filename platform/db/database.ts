import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { PLATFORM_MIGRATIONS } from "./schema";

const DEFAULT_DB_PATH = path.resolve(process.cwd(), "data/platform.db");

export type PlatformDatabase = DatabaseSync;

export function resolveDatabasePath(databaseUrl = process.env.DATABASE_URL): string {
  if (!databaseUrl?.trim()) {
    return DEFAULT_DB_PATH;
  }

  if (databaseUrl.startsWith("file:")) {
    return path.resolve(process.cwd(), databaseUrl.slice("file:".length));
  }

  return databaseUrl;
}

export function openPlatformDatabase(databasePath = resolveDatabasePath()): PlatformDatabase {
  mkdirSync(path.dirname(databasePath), { recursive: true });
  const db = new DatabaseSync(databasePath);
  db.exec("PRAGMA foreign_keys = ON");
  return db;
}

function isDuplicateColumnError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.includes("duplicate column name") ||
      error.message.includes("already exists"))
  );
}

export function migratePlatformDatabase(db: PlatformDatabase): void {
  for (const sql of PLATFORM_MIGRATIONS) {
    try {
      db.exec(sql);
    } catch (error) {
      if (!isDuplicateColumnError(error)) {
        throw error;
      }
    }
  }
}

export function openMigratedPlatformDatabase(databasePath?: string): PlatformDatabase {
  const db = openPlatformDatabase(databasePath);
  migratePlatformDatabase(db);
  return db;
}

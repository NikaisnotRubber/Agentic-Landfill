import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { HelpdeskVmSyncLogEntry, HelpdeskVmSyncLogListItem } from "./types";

export const DEFAULT_HELPDESK_VM_SYNC_LOG_DIR = "logs";

type SyncLogOptions = {
  logDir?: string;
};

type WriteSyncLogResult = {
  id: string;
  logPath: string;
};

const LOG_ID_PATTERN = /^helpdesk-vm-sync-\d{8}-\d{6}-[a-z0-9]+$/;

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

function formatLogIdTimestamp(date: Date): string {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "-",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");
}

function createLogId(date = new Date()): string {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `helpdesk-vm-sync-${formatLogIdTimestamp(date)}-${suffix}`;
}

function getLogDir(options: SyncLogOptions): string {
  return options.logDir ?? DEFAULT_HELPDESK_VM_SYNC_LOG_DIR;
}

function assertSafeLogId(id: string): void {
  if (!LOG_ID_PATTERN.test(id)) {
    throw new Error("Invalid sync log id");
  }
}

function getLogPath(id: string, options: SyncLogOptions): string {
  assertSafeLogId(id);
  return path.join(getLogDir(options), `${id}.json`);
}

function normalizeLogEntry(raw: unknown): HelpdeskVmSyncLogEntry {
  const entry = raw as HelpdeskVmSyncLogEntry & { kind?: HelpdeskVmSyncLogEntry["kind"] };
  return {
    ...entry,
    kind: entry.kind ?? "helpdesk-sync",
  };
}

function toListItem(entry: HelpdeskVmSyncLogEntry, logPath: string): HelpdeskVmSyncLogListItem {
  const normalized = normalizeLogEntry(entry);
  return {
    id: normalized.id,
    kind: normalized.kind,
    startedAt: normalized.startedAt,
    finishedAt: normalized.finishedAt,
    ok: normalized.ok,
    warningCount: normalized.warnings.length,
    logPath,
  };
}

export async function writeHelpdeskVmSyncLog(
  entry: Omit<HelpdeskVmSyncLogEntry, "id">,
  options: SyncLogOptions = {},
): Promise<WriteSyncLogResult> {
  const id = createLogId();
  const logDir = getLogDir(options);
  const logPath = path.join(logDir, `${id}.json`);
  const payload: HelpdeskVmSyncLogEntry = { id, ...entry };

  await mkdir(logDir, { recursive: true });
  await writeFile(logPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  return { id, logPath };
}

export async function listHelpdeskVmSyncLogs(
  options: SyncLogOptions = {},
): Promise<HelpdeskVmSyncLogListItem[]> {
  const logDir = getLogDir(options);

  let names: string[];
  try {
    names = await readdir(logDir);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const entries = await Promise.all(
    names
      .filter((name) => name.startsWith("helpdesk-vm-sync-") && name.endsWith(".json"))
      .map(async (name) => {
        const logPath = path.join(logDir, name);
        const payload = normalizeLogEntry(JSON.parse(await readFile(logPath, "utf8")));
        return toListItem(payload, logPath);
      }),
  );

  return entries.sort((left, right) => right.finishedAt.localeCompare(left.finishedAt));
}

export async function readHelpdeskVmSyncLog(
  id: string,
  options: SyncLogOptions = {},
): Promise<HelpdeskVmSyncLogEntry> {
  const logPath = getLogPath(id, options);
  return normalizeLogEntry(JSON.parse(await readFile(logPath, "utf8")));
}

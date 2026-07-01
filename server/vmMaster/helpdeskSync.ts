import {
  createAdLookupClient,
  type AdLookupClient,
  type ManagerAccountLookupResult,
} from "../ad/ldapClient";
import {
  resolveAdChineseName,
  resolveAdEnglishName,
} from "../ad/normalizeAdEntry";
import { applyVmMasterSchema, openVmMasterDatabase, type VmMasterDatabase } from "../db/sqlite";
import { fetchTickets as fetchTicketsImpl } from "../fetchTickets";
import type { TicketFetchResult } from "../types";
import { parseHelpdeskTicketForVmSync } from "./helpdeskTicketParser";
import {
  findManagerAdName,
  findManagerAssignments,
  replaceUserVmAssignments,
  upsertVmUserForSync,
} from "./repository";
import { writeHelpdeskVmSyncLog } from "./syncLog";
import type {
  HelpdeskVmSyncOptions,
  HelpdeskVmSyncResult,
  HelpdeskVmSyncSummary,
  HelpdeskVmSyncWarning,
  HelpdeskVmTicketParseSuccess,
} from "./types";

type SyncDeps = {
  fetchTickets?: (options: HelpdeskVmSyncOptions) => Promise<TicketFetchResult>;
  createLookupClient?: () => AdLookupClient;
  openDatabase?: () => VmMasterDatabase;
  applySchema?: (database: VmMasterDatabase) => void;
  logDir?: string;
};

function createEmptySummary(): HelpdeskVmSyncSummary {
  return {
    fetchedTicketCount: 0,
    parsedTicketCount: 0,
    ldapEnrichedCount: 0,
    skippedTicketCount: 0,
    managerMatchedCount: 0,
    userUpsertedCount: 0,
    assignmentReplacedCount: 0,
    assignmentInsertedCount: 0,
    warnings: [],
  };
}

function dedupeParsedTickets(
  parsedTickets: HelpdeskVmTicketParseSuccess[],
): HelpdeskVmTicketParseSuccess[] {
  const byAdName = new Map<string, HelpdeskVmTicketParseSuccess>();
  for (const parsed of parsedTickets) {
    byAdName.set(parsed.adName, parsed);
  }
  return [...byAdName.values()];
}

function pad(value: number, length = 2): string {
  return value.toString().padStart(length, "0");
}

function formatLogTimestamp(date = new Date()): string {
  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())},${pad(
      date.getMilliseconds(),
      3,
    )}`,
  ].join(" ");
}

function formatWarningLogMessage(warning: HelpdeskVmSyncWarning): string {
  return [
    `[${warning.stage}]`,
    warning.ticketId,
    warning.adName,
    warning.code,
    warning.message,
  ]
    .filter(Boolean)
    .join(" ");
}

export async function syncHelpdeskVmMaster(
  options: HelpdeskVmSyncOptions,
  deps: SyncDeps = {},
): Promise<HelpdeskVmSyncResult> {
  const fetchTickets = deps.fetchTickets ?? fetchTicketsImpl;
  const createLookupClient = deps.createLookupClient ?? createAdLookupClient;
  const openDatabase = deps.openDatabase ?? openVmMasterDatabase;
  const applySchema = deps.applySchema ?? applyVmMasterSchema;
  const summary = createEmptySummary();
  const syncOptions = {
    ...options,
    ddpOnly: options.ddpOnly ?? true,
  };
  const startedAt = new Date().toISOString();
  const logs: string[] = [];

  function appendLog(level: "INFO" | "WARN" | "ERROR", message: string): void {
    logs.push(`${formatLogTimestamp()} ${level} ${message}`);
  }

  function appendWarning(warning: HelpdeskVmSyncWarning): void {
    summary.warnings.push(warning);
    appendLog("WARN", formatWarningLogMessage(warning));
  }

  async function withExecutionLog(result: HelpdeskVmSyncResult): Promise<HelpdeskVmSyncResult> {
    const finishedAt = new Date().toISOString();
    const logSummary = result.ok ? result.summary : summary;

    try {
      const { id, logPath } = await writeHelpdeskVmSyncLog(
        {
          startedAt,
          finishedAt,
          ok: result.ok,
          kind: "helpdesk-sync",
          options: syncOptions,
          requestSummary: {
            requestedTicketCount: syncOptions.count,
            fetchedTicketCount: summary.fetchedTicketCount,
            parsedTicketCount: summary.parsedTicketCount,
            tickets: fetchResult?.ok
              ? fetchResult.tickets.slice(0, 5).map((ticket) => ({
                  ticketId: ticket.id,
                  requester: ticket.requester,
                  subject: ticket.subject,
                }))
              : [],
          },
          summary: logSummary,
          warnings: logSummary.warnings,
          logs,
          error: result.ok ? undefined : result.error,
        },
        { logDir: deps.logDir },
      );

      if (result.ok) {
        result.summary.logId = id;
        result.summary.logPath = logPath;
        return result;
      }

      return { ...result, logId: id, logPath };
    } catch (error) {
      const message = error instanceof Error ? error.message : "sync log write failed";
      if (result.ok) {
        result.summary.warnings.push({
          ticketId: "sync-log",
          stage: "db",
          code: "log-write-failed",
          message,
        });
      }
      return result;
    }
  }

  let fetchResult!: TicketFetchResult;
  try {
    appendLog("INFO", `starting helpdesk VM sync count=${syncOptions.count}`);
    fetchResult = await fetchTickets(syncOptions);
  } catch (error) {
    const result: HelpdeskVmSyncResult = {
      ok: false,
      error: error instanceof Error ? error.message : "Helpdesk fetch failed",
    };
    appendLog("ERROR", result.error);
    return withExecutionLog(result);
  }

  if (!fetchResult.ok) {
    appendLog("ERROR", fetchResult.error);
    return withExecutionLog({ ok: false, error: fetchResult.error });
  }

  summary.fetchedTicketCount = fetchResult.tickets.length;
  appendLog("INFO", `fetched ${summary.fetchedTicketCount} tickets`);

  const parsedTickets: HelpdeskVmTicketParseSuccess[] = [];
  for (const ticket of fetchResult.tickets) {
    const parsed = parseHelpdeskTicketForVmSync(ticket);
    if (!parsed.ok) {
      summary.skippedTicketCount += 1;
      appendWarning({
        ticketId: parsed.ticketId,
        stage: "ticket-parse",
        code: parsed.reason,
        message: "ticket did not include a usable AD account",
      });
      continue;
    }
    summary.parsedTicketCount += 1;
    parsedTickets.push(parsed);
  }

  const lookupClient = createLookupClient();
  const database = openDatabase();
  const shouldCloseDatabase = !deps.openDatabase;

  try {
    applySchema(database);

    for (const parsed of dedupeParsedTickets(parsedTickets)) {
      let user: Awaited<ReturnType<AdLookupClient["lookupUser"]>>;
      try {
        user = await lookupClient.lookupUser(parsed.adName);
      } catch (error) {
        summary.skippedTicketCount += 1;
        appendWarning({
          ticketId: parsed.ticketId,
          adName: parsed.adName,
          stage: "ldap",
          code: "lookup-failed",
          message: `LDAP lookup failed for ${parsed.adName}`,
          detail: error instanceof Error ? error.message : String(error),
        });
        continue;
      }

      if (!user) {
        summary.skippedTicketCount += 1;
        appendWarning({
          ticketId: parsed.ticketId,
          adName: parsed.adName,
          stage: "ldap",
          code: "user-not-found",
          message: `LDAP user not found for ${parsed.adName}`,
        });
        continue;
      }

      summary.ldapEnrichedCount += 1;

      let managerAccount: ManagerAccountLookupResult | null = null;
      if (user.managerDn) {
        try {
          managerAccount = await lookupClient.lookupManagerAccount(user.managerDn);
        } catch (error) {
          appendWarning({
            ticketId: parsed.ticketId,
            adName: parsed.adName,
            stage: "manager-resolution",
            code: "manager-account-lookup-failed",
            message: `manager account lookup failed for ${parsed.adName}`,
            detail: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const reportTo = managerAccount?.adAccount || resolveAdEnglishName(user.manager);
      if (!managerAccount?.adAccount && user.manager) {
        appendWarning({
          ticketId: parsed.ticketId,
          adName: parsed.adName,
          stage: "manager-resolution",
          code: "manager-account-fallback",
          message: `manager account fallback used for ${parsed.adName}`,
          detail: `REPORT_TO=${reportTo}`,
        });
      }

      database.exec("BEGIN");
      try {
        upsertVmUserForSync(database, {
          adName: parsed.adName,
          chnName: resolveAdChineseName(user.displayName),
          emailAddress: user.mail,
          bg: user.bg,
          bu: user.bu,
          userRole: parsed.userRole,
          userDept: user.department,
          reportTo,
        });
        summary.userUpsertedCount += 1;

        const managerAdName = findManagerAdName(database, reportTo);
        if (!managerAdName) {
          appendWarning({
            ticketId: parsed.ticketId,
            adName: parsed.adName,
            stage: "manager-resolution",
            code: "manager-not-found",
            message: `manager not found for ${parsed.adName}`,
            detail: `REPORT_TO=${reportTo} could not match vm_users.ad_name or vm_users.chn_name`,
          });
          database.exec("COMMIT");
          continue;
        }

        const managerAssignments = findManagerAssignments(database, managerAdName);
        if (managerAssignments.length === 0) {
          appendWarning({
            ticketId: parsed.ticketId,
            adName: parsed.adName,
            stage: "vm-inference",
            code: "manager-has-no-vm-assignments",
            message: `manager has no VM assignments for ${parsed.adName}`,
            detail: `managerAdName=${managerAdName}`,
          });
          database.exec("COMMIT");
          continue;
        }

        summary.managerMatchedCount += 1;
        const replacement = replaceUserVmAssignments(database, parsed.adName, managerAssignments);
        summary.assignmentReplacedCount += replacement.replacedCount;
        summary.assignmentInsertedCount += replacement.insertedCount;

        database.exec("COMMIT");
        appendLog(
          "INFO",
          `synced ${parsed.adName} from manager ${managerAdName}: ${replacement.insertedCount} assignments inserted`,
        );
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
    }

    appendLog("INFO", `completed helpdesk VM sync with ${summary.warnings.length} warnings`);
    return withExecutionLog({ ok: true, summary });
  } catch (error) {
    const result: HelpdeskVmSyncResult = {
      ok: false,
      error: error instanceof Error ? error.message : "Helpdesk VM sync failed",
    };
    appendLog("ERROR", result.error);
    return withExecutionLog(result);
  } finally {
    await lookupClient.close();
    if (shouldCloseDatabase) {
      database.close();
    }
  }
}

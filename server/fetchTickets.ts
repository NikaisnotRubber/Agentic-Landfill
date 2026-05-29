import path from "node:path";

import { chromium } from "playwright";

import { DEFAULT_HELPDESK_AUTH_CONFIG_PATH } from "./auth/defaultHelpdeskAuthConfigPath";
import { ensureHelpdeskSession as ensureHelpdeskSessionImpl } from "./auth/ensureHelpdeskSession";
import { loginAndSaveState as loginAndSaveStateImpl } from "./auth/loginAndSaveState";
import {
  DEFAULT_FILTER_ID,
  HELPDESK_BASE_URL,
  buildHelpdeskApiUrl,
  cleanTicketRecords,
  isHelpdeskAuthFailure,
} from "./helpdeskApi";
import { filterTicketsForDdp } from "./helpdeskFilters";
import { resolveBrowserLaunchOptions } from "./browserLaunch";
import type {
  FetchTicketsOptions,
  TicketFetchFailure,
  TicketFetchResult,
  TicketFetchSuccess,
} from "./types";

const DEFAULT_STATE_FILE = path.resolve(
  process.cwd(),
  "IT工單(不可用，僅供參考)",
  "delta_sso_state.json",
);

type HelpdeskFetchPayload = {
  httpStatus: number;
  json: unknown;
};

type ExecuteTicketFetch = (options: {
  stateFile: string;
  targetUrl: string;
  baseUrl: string;
}) => Promise<HelpdeskFetchPayload>;

type FetchTicketsDeps = {
  ensureHelpdeskSession?: typeof ensureHelpdeskSessionImpl;
  executeTicketFetch?: ExecuteTicketFetch;
  loginAndSaveState?: typeof loginAndSaveStateImpl;
};

function shouldRefreshAuth(payload: HelpdeskFetchPayload): boolean {
  return payload.httpStatus === 401
    || payload.httpStatus === 403
    || isHelpdeskAuthFailure(payload.json);
}

async function executeTicketFetchWithBrowser(
  options: {
    stateFile: string;
    targetUrl: string;
    baseUrl: string;
  },
): Promise<HelpdeskFetchPayload> {
  const browser = await chromium.launch({
    headless: true,
    ...resolveBrowserLaunchOptions(),
  });

  try {
    const context = await browser.newContext({
      storageState: options.stateFile,
    });
    const page = await context.newPage();

    await page.goto(options.baseUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });

    return await page.evaluate(async (url) => {
      const response = await fetch(url, { credentials: "include" });
      return {
        httpStatus: response.status,
        json: await response.json(),
      };
    }, options.targetUrl);
  } finally {
    await browser.close();
  }
}

function normalizeFetchSuccess(
  payload: unknown,
  technician?: string,
): TicketFetchSuccess {
  const requests = (payload as { requests?: unknown[] }).requests as unknown;
  if (!Array.isArray(requests)) {
    throw new Error("Helpdesk API response is missing the requests array.");
  }

  const technicianName = technician?.trim();

  const tickets = filterTicketsForDdp(cleanTicketRecords(requests)).filter(
    (ticket) => {
      if (!technicianName) {
        return true;
      }
      return ticket.technician.trim() === technicianName;
    },
  );

  return {
    ok: true,
    source: "live",
    count: tickets.length,
    tickets,
    raw: payload,
  };
}

function normalizeHttpFailure(payload: HelpdeskFetchPayload): TicketFetchFailure {
  return {
    ok: false,
    source: "live",
    error: `Helpdesk API request failed with HTTP ${payload.httpStatus}.`,
    details: payload.json,
  };
}

export async function fetchTickets(
  options: FetchTicketsOptions,
  deps: FetchTicketsDeps = {},
): Promise<TicketFetchResult> {
  const stateFile = options.stateFile ?? DEFAULT_STATE_FILE;
  const targetUrl = buildHelpdeskApiUrl({
    count: options.count,
    filterId: options.filterId ?? DEFAULT_FILTER_ID,
  });
  const baseUrl = options.baseUrl ?? HELPDESK_BASE_URL;
  const ensureHelpdeskSession =
    deps.ensureHelpdeskSession ?? ensureHelpdeskSessionImpl;
  const executeTicketFetch =
    deps.executeTicketFetch ?? executeTicketFetchWithBrowser;
  const loginAndSaveState = deps.loginAndSaveState ?? loginAndSaveStateImpl;

  try {
    await ensureHelpdeskSession({ stateFile, baseUrl });

    const firstPayload = await executeTicketFetch({
      stateFile,
      targetUrl,
      baseUrl,
    });

    if (shouldRefreshAuth(firstPayload)) {
      const refreshedSession = await loginAndSaveState({
        configPath: DEFAULT_HELPDESK_AUTH_CONFIG_PATH,
        stateFile,
        baseUrl,
      });

      const secondPayload = await executeTicketFetch({
        stateFile: refreshedSession.stateFile,
        targetUrl,
        baseUrl: refreshedSession.baseUrl,
      });

      if (shouldRefreshAuth(secondPayload)) {
        return {
          ok: false,
          source: "live",
          error:
            "Helpdesk session refresh succeeded but API still reports unauthorized access.",
          details: secondPayload.json,
        };
      }

      if (secondPayload.httpStatus >= 400) {
        return normalizeHttpFailure(secondPayload);
      }

      return normalizeFetchSuccess(secondPayload.json, options.technician);
    }

    if (firstPayload.httpStatus >= 400) {
      return normalizeHttpFailure(firstPayload);
    }

    return normalizeFetchSuccess(firstPayload.json, options.technician);
  } catch (error) {
    return {
      ok: false,
      source: "live",
      error: error instanceof Error ? error.message : "Unknown fetch failure",
    };
  }
}

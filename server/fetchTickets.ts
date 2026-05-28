import path from "node:path";
import { existsSync } from "node:fs";

import { chromium } from "playwright";

import {
  DEFAULT_FILTER_ID,
  HELPDESK_BASE_URL,
  buildHelpdeskApiUrl,
  cleanTicketRecords,
  isHelpdeskAuthFailure,
} from "./helpdeskApi";
import type { FetchTicketsOptions, TicketFetchResult } from "./types";

const DEFAULT_STATE_FILE = path.resolve(
  process.cwd(),
  "IT工單(不可用，僅供參考)",
  "delta_sso_state.json",
);

function resolveBrowserLaunchOptions() {
  const configuredPath = process.env.HELPDESK_BROWSER_PATH;
  if (configuredPath) {
    return { executablePath: configuredPath };
  }

  if (existsSync("/usr/bin/google-chrome")) {
    return { executablePath: "/usr/bin/google-chrome" };
  }

  return {};
}

export async function fetchTickets(
  options: FetchTicketsOptions,
): Promise<TicketFetchResult> {
  const stateFile = options.stateFile ?? DEFAULT_STATE_FILE;
  const targetUrl = buildHelpdeskApiUrl({
    count: options.count,
    filterId: options.filterId ?? DEFAULT_FILTER_ID,
  });

  const browser = await chromium.launch({
    headless: true,
    ...resolveBrowserLaunchOptions(),
  });

  try {
    const context = await browser.newContext({
      storageState: stateFile,
    });
    const page = await context.newPage();

    await page.goto(options.baseUrl ?? HELPDESK_BASE_URL, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });

    const payload = await page.evaluate(async (url) => {
      const response = await fetch(url, { credentials: "include" });
      return {
        httpStatus: response.status,
        json: await response.json(),
      };
    }, targetUrl);

    if (isHelpdeskAuthFailure(payload.json)) {
      return {
        ok: false,
        source: "live",
        error: "Helpdesk session is invalid or expired. Refresh delta_sso_state.json.",
        details: payload.json,
      };
    }

    const requests = Array.isArray((payload.json as { requests?: unknown[] }).requests)
      ? ((payload.json as { requests: unknown[] }).requests)
      : [];

    const tickets = cleanTicketRecords(requests).filter((ticket) => {
      if (!options.technician) {
        return true;
      }
      return ticket.technician.trim() === options.technician.trim();
    });

    return {
      ok: true,
      source: "live",
      count: tickets.length,
      tickets,
      raw: payload.json,
    };
  } catch (error) {
    return {
      ok: false,
      source: "live",
      error: error instanceof Error ? error.message : "Unknown fetch failure",
    };
  } finally {
    await browser.close();
  }
}

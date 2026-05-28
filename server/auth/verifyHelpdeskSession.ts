import type { Browser } from "playwright";

import {
  DEFAULT_FILTER_ID,
  HELPDESK_BASE_URL,
  buildHelpdeskApiUrl,
  isHelpdeskAuthFailure,
} from "../helpdeskApi";

type VerifyHelpdeskSessionOptions = {
  browser: Browser;
  stateFile: string;
  baseUrl?: string;
};

export async function verifyHelpdeskSession({
  browser,
  stateFile,
  baseUrl = HELPDESK_BASE_URL,
}: VerifyHelpdeskSessionOptions): Promise<{ ok: true }> {
  const targetUrl = buildHelpdeskApiUrl({
    count: 1,
    filterId: DEFAULT_FILTER_ID,
  });

  const context = await browser.newContext({
    storageState: stateFile,
  });

  try {
    const page = await context.newPage();
    await page.goto(baseUrl, {
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
      throw new Error("Saved storage state is not authenticated.");
    }

    const requests = (payload.json as { requests?: unknown[] }).requests;
    if (!Array.isArray(requests)) {
      throw new Error("Helpdesk API validation did not return requests.");
    }

    return { ok: true };
  } finally {
    await context.close();
  }
}

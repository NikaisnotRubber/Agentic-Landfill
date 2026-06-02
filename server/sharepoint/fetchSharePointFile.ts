import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";

import { chromium, type Browser } from "playwright";

import { resolveBrowserLaunchOptions } from "../browserLaunch";
import {
  buildSharePointDownloadUrl,
  loadSharePointConfig,
  type SharePointConfig,
} from "./sharePointConfig";

type LaunchBrowser = (options: { headless: boolean }) => Promise<Browser>;

export type FetchSharePointFileOptions = {
  configPath: string;
  launchBrowser?: LaunchBrowser;
  exists?: (target: string) => boolean;
};

export type FetchSharePointFileResult = {
  ok: true;
  outputFile: string;
  stateFile: string;
  downloadUrl: string;
};

async function ensureSharePointSession(
  config: SharePointConfig,
  launchBrowser: LaunchBrowser,
  exists: (target: string) => boolean,
): Promise<void> {
  if (exists(config.stateFile)) {
    return;
  }

  const browser = await launchBrowser({ headless: false });
  try {
    const context = await browser.newContext({ acceptDownloads: true });
    try {
      const page = await context.newPage();
      await page.goto(config.siteUrl, { timeout: 120_000 });
      await page.waitForURL("**/sites/**", { timeout: 120_000 });
      await context.storageState({ path: config.stateFile });
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

export async function fetchSharePointFile(
  options: FetchSharePointFileOptions,
): Promise<FetchSharePointFileResult> {
  const config = await loadSharePointConfig(options.configPath);
  const exists = options.exists ?? existsSync;
  const launchBrowser =
    options.launchBrowser ??
    ((launchOptions) =>
      chromium.launch({ ...launchOptions, ...resolveBrowserLaunchOptions() }));

  await ensureSharePointSession(config, launchBrowser, exists);

  const downloadUrl = buildSharePointDownloadUrl(config.siteUrl, config.fileUniqueId);
  const browser = await launchBrowser({ headless: config.headless });
  try {
    const context = await browser.newContext({
      storageState: config.stateFile,
      acceptDownloads: true,
    });
    try {
      const page = await context.newPage();
      const downloadPromise = page.waitForEvent("download", { timeout: 60_000 });
      try {
        await page.goto(downloadUrl);
      } catch {
        // Direct download URLs may abort navigation; the download event still fires.
      }
      const download = await downloadPromise;
      await mkdir(path.dirname(config.outputFile), { recursive: true });
      await download.saveAs(config.outputFile);
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
  }

  return {
    ok: true,
    outputFile: config.outputFile,
    stateFile: config.stateFile,
    downloadUrl,
  };
}

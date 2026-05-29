import { chromium, type Browser } from "playwright";

import { resolveBrowserLaunchOptions } from "../browserLaunch";
import {
  loadHelpdeskAuthConfig,
  type HelpdeskAuthConfig,
} from "./helpdeskConfig";
import { performHelpdeskLogin } from "./helpdeskLogin";
import { verifyHelpdeskSession } from "./verifyHelpdeskSession";

type LoadConfig = (configPath: string) => Promise<HelpdeskAuthConfig>;
type LaunchBrowser = (options: { headless: boolean }) => Promise<Browser>;
type PerformLogin = typeof performHelpdeskLogin;
type VerifySession = typeof verifyHelpdeskSession;

type LoginAndSaveStateOptions = {
  configPath: string;
  stateFile?: string;
  baseUrl?: string;
  loadConfig?: LoadConfig;
  launchBrowser?: LaunchBrowser;
  performLogin?: PerformLogin;
  verifySession?: VerifySession;
};

export async function loginAndSaveState(
  options: LoginAndSaveStateOptions,
): Promise<{ ok: true; stateFile: string; baseUrl: string }> {
  const loadConfig = options.loadConfig ?? loadHelpdeskAuthConfig;
  const launchBrowser =
    options.launchBrowser ??
    ((launchOptions) => chromium.launch({ ...launchOptions, ...resolveBrowserLaunchOptions() }));
  const performLogin = options.performLogin ?? performHelpdeskLogin;
  const verifySession = options.verifySession ?? verifyHelpdeskSession;

  const config = await loadConfig(options.configPath);
  const effectiveConfig = {
    ...config,
    stateFile: options.stateFile ?? config.stateFile,
    baseUrl: options.baseUrl ?? config.baseUrl,
  };
  const browser = await launchBrowser({ headless: effectiveConfig.headless });

  try {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await performLogin(page, effectiveConfig);
      await context.storageState({ path: effectiveConfig.stateFile });
    } finally {
      await context.close();
    }

    await verifySession({
      browser,
      stateFile: effectiveConfig.stateFile,
      baseUrl: effectiveConfig.baseUrl,
    });

    return {
      ok: true,
      stateFile: effectiveConfig.stateFile,
      baseUrl: effectiveConfig.baseUrl,
    };
  } finally {
    await browser.close();
  }
}

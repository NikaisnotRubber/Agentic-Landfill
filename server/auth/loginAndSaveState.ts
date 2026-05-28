import { chromium, type Browser } from "playwright";

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
    ((launchOptions) => chromium.launch(launchOptions));
  const performLogin = options.performLogin ?? performHelpdeskLogin;
  const verifySession = options.verifySession ?? verifyHelpdeskSession;

  const config = await loadConfig(options.configPath);
  const browser = await launchBrowser({ headless: config.headless });

  try {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await performLogin(page, config);
      await context.storageState({ path: config.stateFile });
    } finally {
      await context.close();
    }

    await verifySession({
      browser,
      stateFile: config.stateFile,
      baseUrl: config.baseUrl,
    });

    return {
      ok: true,
      stateFile: config.stateFile,
      baseUrl: config.baseUrl,
    };
  } finally {
    await browser.close();
  }
}

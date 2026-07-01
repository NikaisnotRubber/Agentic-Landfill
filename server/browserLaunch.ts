import { existsSync } from "node:fs";
import { chromium } from "playwright";

type ResolveBrowserLaunchOptionsArgs = {
  env?: NodeJS.ProcessEnv;
  exists?: (target: string) => boolean;
  playwrightExecutablePath?: () => string;
};

function getPlaywrightExecutablePath(): string {
  return chromium.executablePath();
}

export function resolveBrowserLaunchOptions(
  args: ResolveBrowserLaunchOptionsArgs = {},
): { executablePath?: string } {
  const env = args.env ?? process.env;
  const exists = args.exists ?? existsSync;

  const configuredPath = env.HELPDESK_BROWSER_PATH;
  if (configuredPath) {
    return { executablePath: configuredPath };
  }

  const playwrightPath = (args.playwrightExecutablePath ?? getPlaywrightExecutablePath)();
  if (playwrightPath && exists(playwrightPath)) {
    return { executablePath: playwrightPath };
  }

  return {};
}

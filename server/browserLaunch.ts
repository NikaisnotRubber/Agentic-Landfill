import { existsSync } from "node:fs";

type ResolveBrowserLaunchOptionsArgs = {
  env?: NodeJS.ProcessEnv;
  exists?: (target: string) => boolean;
};

export function resolveBrowserLaunchOptions(
  args: ResolveBrowserLaunchOptionsArgs = {},
): { executablePath?: string } {
  const env = args.env ?? process.env;
  const exists = args.exists ?? existsSync;

  const configuredPath = env.HELPDESK_BROWSER_PATH;
  if (configuredPath) {
    return { executablePath: configuredPath };
  }

  if (exists("/usr/bin/google-chrome")) {
    return { executablePath: "/usr/bin/google-chrome" };
  }

  return {};
}

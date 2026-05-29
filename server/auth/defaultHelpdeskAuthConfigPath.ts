import path from "node:path";

export const DEFAULT_HELPDESK_AUTH_CONFIG_PATH = path.resolve(
  process.cwd(),
  "config",
  "helpdesk-auth.yaml",
);

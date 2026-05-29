import { readFile } from "node:fs/promises";
import path from "node:path";

import { parse } from "yaml";

export type HelpdeskAuthConfig = {
  baseUrl: string;
  username: string;
  password: string;
  domain: string;
  stateFile: string;
  headless: boolean;
};

const DEFAULT_BASE_URL = "https://ithelpdesk.deltaww.com/";
const DEFAULT_DOMAIN = "DELTA";
const DEFAULT_STATE_FILE = path.resolve(
  process.cwd(),
  "IT工單(不可用，僅供參考)",
  "delta_sso_state.json",
);

function readRequiredString(
  rawConfig: Record<string, unknown>,
  key: "username" | "password",
): string {
  const value = rawConfig[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing required helpdesk auth config key: ${key}`);
  }

  return value.trim();
}

export async function loadHelpdeskAuthConfig(configPath: string): Promise<HelpdeskAuthConfig> {
  const rawText = await readFile(configPath, "utf8");
  const parsed = parse(rawText);

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Helpdesk auth config must be a YAML object.");
  }

  const rawConfig = parsed as Record<string, unknown>;
  const baseUrl =
    typeof rawConfig.baseUrl === "string" && rawConfig.baseUrl.trim()
      ? rawConfig.baseUrl.trim()
      : DEFAULT_BASE_URL;
  const domain =
    typeof rawConfig.domain === "string" && rawConfig.domain.trim()
      ? rawConfig.domain.trim()
      : DEFAULT_DOMAIN;
  const stateFileRaw =
    typeof rawConfig.stateFile === "string" && rawConfig.stateFile.trim()
      ? rawConfig.stateFile.trim()
      : DEFAULT_STATE_FILE;
  const headless = typeof rawConfig.headless === "boolean" ? rawConfig.headless : false;

  return {
    baseUrl,
    username: readRequiredString(rawConfig, "username"),
    password: readRequiredString(rawConfig, "password"),
    domain,
    stateFile: path.isAbsolute(stateFileRaw)
      ? stateFileRaw
      : path.resolve(process.cwd(), stateFileRaw),
    headless,
  };
}

import { readFile } from "node:fs/promises";
import path from "node:path";

import { parse } from "yaml";

export type SharePointConfig = {
  siteUrl: string;
  fileUniqueId: string;
  outputFile: string;
  stateFile: string;
  headless: boolean;
};

const DEFAULT_SITE_URL = "https://deltao365.sharepoint.com/sites/DDP125";
const DEFAULT_FILE_UNIQUE_ID = "3EBC0414-BB1C-4788-A97F-8EB7B78F889F";
const DEFAULT_OUTPUT_FILE = "VM_PhaseI_Rollout_Schedule.xlsx";
const DEFAULT_STATE_FILE = path.resolve(
  process.cwd(),
  "IT工單(不可用，僅供參考)",
  "sp_state.json",
);

function resolvePath(value: string): string {
  return path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);
}

export function buildSharePointDownloadUrl(siteUrl: string, fileUniqueId: string): string {
  const normalizedSite = siteUrl.replace(/\/+$/, "");
  return `${normalizedSite}/_layouts/15/download.aspx?UniqueId=${fileUniqueId}`;
}

export async function loadSharePointConfig(configPath: string): Promise<SharePointConfig> {
  const rawText = await readFile(configPath, "utf8");
  const parsed = parse(rawText);

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("SharePoint config must be a YAML object.");
  }

  const rawConfig = parsed as Record<string, unknown>;
  const siteUrl =
    typeof rawConfig.siteUrl === "string" && rawConfig.siteUrl.trim()
      ? rawConfig.siteUrl.trim()
      : DEFAULT_SITE_URL;
  const fileUniqueId =
    typeof rawConfig.fileUniqueId === "string" && rawConfig.fileUniqueId.trim()
      ? rawConfig.fileUniqueId.trim()
      : DEFAULT_FILE_UNIQUE_ID;
  const outputFileRaw =
    typeof rawConfig.outputFile === "string" && rawConfig.outputFile.trim()
      ? rawConfig.outputFile.trim()
      : DEFAULT_OUTPUT_FILE;
  const stateFileRaw =
    typeof rawConfig.stateFile === "string" && rawConfig.stateFile.trim()
      ? rawConfig.stateFile.trim()
      : DEFAULT_STATE_FILE;
  const headless = typeof rawConfig.headless === "boolean" ? rawConfig.headless : true;

  return {
    siteUrl,
    fileUniqueId,
    outputFile: resolvePath(outputFileRaw),
    stateFile: resolvePath(stateFileRaw),
    headless,
  };
}

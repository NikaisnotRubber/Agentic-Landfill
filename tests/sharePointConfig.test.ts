import { describe, expect, it } from "vitest";

import {
  buildSharePointDownloadUrl,
  loadSharePointConfig,
} from "../server/sharepoint/sharePointConfig";

describe("sharePointConfig", () => {
  it("builds download URL from site and unique id", () => {
    expect(
      buildSharePointDownloadUrl(
        "https://deltao365.sharepoint.com/sites/DDP125/",
        "3EBC0414-BB1C-4788-A97F-8EB7B78F889F",
      ),
    ).toBe(
      "https://deltao365.sharepoint.com/sites/DDP125/_layouts/15/download.aspx?UniqueId=3EBC0414-BB1C-4788-A97F-8EB7B78F889F",
    );
  });

  it("loads example config with defaults", async () => {
    const config = await loadSharePointConfig("config/sharepoint.example.yaml");
    expect(config.siteUrl).toContain("sharepoint.com");
    expect(config.fileUniqueId).toMatch(/^[0-9A-F-]+$/i);
    expect(config.outputFile).toMatch(/VM_PhaseI_Rollout_Schedule\.xlsx$/);
    expect(config.stateFile).toMatch(/sp_state\.json$/);
  });
});

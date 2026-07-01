import { describe, expect, it } from "vitest";

import { resolveBrowserLaunchOptions } from "../server/browserLaunch";

describe("resolveBrowserLaunchOptions", () => {
  it("prefers HELPDESK_BROWSER_PATH when configured", () => {
    expect(
      resolveBrowserLaunchOptions({
        env: { HELPDESK_BROWSER_PATH: "/custom/chrome" },
        exists: () => true,
      }),
    ).toEqual({ executablePath: "/custom/chrome" });
  });

  it("uses Playwright-managed Chromium by default", () => {
    expect(
      resolveBrowserLaunchOptions({
        env: {},
        exists: (target) => target === "/local/ms-playwright/chrome.exe",
        playwrightExecutablePath: () => "/local/ms-playwright/chrome.exe",
      }),
    ).toEqual({ executablePath: "/local/ms-playwright/chrome.exe" });
  });

  it("does not fall back to system Chrome when Playwright browser is unavailable", () => {
    expect(
      resolveBrowserLaunchOptions({
        env: {},
        exists: (target) => target === "/usr/bin/google-chrome",
        playwrightExecutablePath: () => "/missing/ms-playwright/chrome.exe",
      }),
    ).toEqual({});
  });
});

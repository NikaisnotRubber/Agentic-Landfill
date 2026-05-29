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

  it("falls back to system google chrome when available", () => {
    expect(
      resolveBrowserLaunchOptions({
        env: {},
        exists: (target) => target === "/usr/bin/google-chrome",
      }),
    ).toEqual({ executablePath: "/usr/bin/google-chrome" });
  });

  it("returns empty options when no browser override exists", () => {
    expect(
      resolveBrowserLaunchOptions({
        env: {},
        exists: () => false,
      }),
    ).toEqual({});
  });
});

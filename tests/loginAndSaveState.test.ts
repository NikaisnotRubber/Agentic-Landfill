import { describe, expect, it, vi } from "vitest";

import { loginAndSaveState } from "../server/auth/loginAndSaveState";

describe("loginAndSaveState", () => {
  it("loads config, performs login, saves state, and verifies the saved session", async () => {
    const storageState = vi.fn().mockResolvedValue(undefined);
    const closeContext = vi.fn().mockResolvedValue(undefined);
    const closeBrowser = vi.fn().mockResolvedValue(undefined);
    const page = {};
    const context = {
      newPage: vi.fn().mockResolvedValue(page),
      storageState,
      close: closeContext,
    };
    const browser = {
      newContext: vi.fn().mockResolvedValue(context),
      close: closeBrowser,
    };
    const launchBrowser = vi.fn().mockResolvedValue(browser);
    const performLogin = vi.fn().mockResolvedValue(undefined);
    const verifySession = vi.fn().mockResolvedValue({ ok: true });
    const loadConfig = vi.fn().mockResolvedValue({
      baseUrl: "https://ithelpdesk.deltaww.com/",
      username: "JIAHUA.WU",
      password: "secret",
      domain: "DELTA",
      stateFile: "/tmp/state.json",
      headless: false,
    });

    const result = await loginAndSaveState({
      configPath: "config/helpdesk-auth.local.yaml",
      loadConfig,
      launchBrowser,
      performLogin,
      verifySession,
    });

    expect(loadConfig).toHaveBeenCalledWith("config/helpdesk-auth.local.yaml");
    expect(launchBrowser).toHaveBeenCalledWith({ headless: false });
    expect(performLogin).toHaveBeenCalledWith(page, expect.objectContaining({ username: "JIAHUA.WU" }));
    expect(storageState).toHaveBeenCalledWith({ path: "/tmp/state.json" });
    expect(verifySession).toHaveBeenCalledWith({
      browser,
      stateFile: "/tmp/state.json",
      baseUrl: "https://ithelpdesk.deltaww.com/",
    });
    expect(closeContext).toHaveBeenCalledTimes(1);
    expect(closeBrowser).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      ok: true,
      stateFile: "/tmp/state.json",
      baseUrl: "https://ithelpdesk.deltaww.com/",
    });
  });
});

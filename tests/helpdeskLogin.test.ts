import { describe, expect, it, vi } from "vitest";

import { performHelpdeskLogin } from "../server/auth/helpdeskLogin";

function createLocator() {
  return {
    fill: vi.fn().mockResolvedValue(undefined),
    click: vi.fn().mockResolvedValue(undefined),
    selectOption: vi.fn().mockResolvedValue(undefined),
    waitFor: vi.fn().mockResolvedValue(undefined),
  };
}

describe("performHelpdeskLogin", () => {
  it("fills username, password, selects domain, and clicks Log in", async () => {
    const username = createLocator();
    const password = createLocator();
    const domain = createLocator();
    const submit = createLocator();
    const page = {
      goto: vi.fn().mockResolvedValue(undefined),
      waitForLoadState: vi.fn().mockResolvedValue(undefined),
      getByRole: vi.fn((role: string, options?: { name?: string }) => {
        if (role === "textbox" && options?.name === "Username") {
          return username;
        }
        if (role === "textbox" && options?.name === "Password") {
          return password;
        }
        if (role === "button" && options?.name === "Log in") {
          return submit;
        }
        if (role === "combobox") {
          return domain;
        }
        throw new Error(`Unexpected locator: ${role}:${options?.name ?? ""}`);
      }),
    };

    await performHelpdeskLogin(page as never, {
      baseUrl: "https://ithelpdesk.deltaww.com/",
      username: "JIAHUA.WU",
      password: "secret",
      domain: "DELTA",
      stateFile: "state.json",
      headless: false,
    });

    expect(page.goto).toHaveBeenCalledWith("https://ithelpdesk.deltaww.com/", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    expect(domain.selectOption).toHaveBeenCalledWith({ label: "DELTA" });
    expect(username.fill).toHaveBeenCalledWith("JIAHUA.WU");
    expect(password.fill).toHaveBeenCalledWith("secret");
    expect(submit.click).toHaveBeenCalledTimes(1);
  });

  it("throws a targeted error when the username field cannot be located", async () => {
    const page = {
      goto: vi.fn().mockResolvedValue(undefined),
      waitForLoadState: vi.fn().mockResolvedValue(undefined),
      getByRole: vi.fn(() => {
        throw new Error("missing locator");
      }),
    };

    await expect(
      performHelpdeskLogin(page as never, {
        baseUrl: "https://ithelpdesk.deltaww.com/",
        username: "JIAHUA.WU",
        password: "secret",
        domain: "DELTA",
        stateFile: "state.json",
        headless: false,
      }),
    ).rejects.toThrow("Username field not found");
  });
});

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

function createResolvableLocator(actions = createLocator()) {
  const self = {
    or: vi.fn(() => self),
    ...actions,
  };
  return self;
}

function createLoginPageMock() {
  const username = createResolvableLocator();
  const password = createResolvableLocator();
  const domain = createResolvableLocator();
  const submit = createResolvableLocator();

  const page = {
    goto: vi.fn().mockResolvedValue(undefined),
    waitForLoadState: vi.fn().mockResolvedValue(undefined),
    locator: vi.fn((selector: string) => {
      if (selector === "#username" || selector === 'input[name="j_username"]') {
        return username;
      }
      if (selector === "#password" || selector === 'input[name="j_password"]') {
        return password;
      }
      if (selector === "#domain_select" || selector === 'select[name="domain"]') {
        return domain;
      }
      if (selector === "#loginSDPage" || selector === 'button[name="loginButton"]') {
        return submit;
      }
      throw new Error(`Unexpected locator selector: ${selector}`);
    }),
    getByRole: vi.fn((role: string, options?: { name?: string }) => {
      if (role === "textbox" && options?.name === "Username") {
        return username;
      }
      if (role === "textbox" && options?.name === "j_username") {
        return username;
      }
      if (role === "textbox" && options?.name === "Password") {
        return password;
      }
      if (role === "textbox" && options?.name === "密碼") {
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

  return { page, username, password, domain, submit };
}

describe("performHelpdeskLogin", () => {
  it("fills username, password, selects domain, and clicks Log in", async () => {
    const { page, username, password, domain, submit } = createLoginPageMock();

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
    const missing = createResolvableLocator();
    missing.waitFor = vi.fn().mockRejectedValue(new Error("missing locator"));

    const page = {
      goto: vi.fn().mockResolvedValue(undefined),
      waitForLoadState: vi.fn().mockResolvedValue(undefined),
      locator: vi.fn(() => missing),
      getByRole: vi.fn(() => missing),
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

import { describe, expect, it, vi } from "vitest";

import {
  detectHelpdeskAutomationEnvironment,
  getDomainSelector,
  getLoginButton,
  getPasswordField,
  getUsernameField,
} from "../server/auth/helpdeskLocators";

function createPageMock() {
  const calls: Array<{ method: "locator" | "getByRole"; args: unknown[] }> = [];

  const page = {
    locator: vi.fn((selector: string) => {
      calls.push({ method: "locator", args: [selector] });
      return { or: vi.fn((next: unknown) => next) };
    }),
    getByRole: vi.fn((role: string, options?: { name?: string }) => {
      calls.push({ method: "getByRole", args: [role, options] });
      return { or: vi.fn((next: unknown) => next) };
    }),
  };

  return { page, calls };
}

describe("helpdeskLocators", () => {
  it("detects the Windows browser automation environment", () => {
    expect(
      detectHelpdeskAutomationEnvironment({
        env: {},
        platform: "win32",
        release: "10.0.22631",
      }),
    ).toBe("windows");
  });

  it("detects the WSL browser automation environment", () => {
    expect(
      detectHelpdeskAutomationEnvironment({
        env: { WSL_DISTRO_NAME: "Ubuntu" },
        platform: "linux",
        release: "6.6.87.2-microsoft-standard-WSL2",
      }),
    ).toBe("wsl");
  });

  it("detects the generic Linux browser automation environment", () => {
    expect(
      detectHelpdeskAutomationEnvironment({
        env: {},
        platform: "linux",
        release: "6.8.0-generic",
      }),
    ).toBe("linux");
  });

  it("builds native-first username locators for Windows", () => {
    const { page, calls } = createPageMock();

    getUsernameField(page as never, { environment: "windows" });

    expect(calls.map((call) => call.args)).toEqual([
      ["#username"],
      ['input[name="j_username"]'],
      ["textbox", { name: "Username" }],
      ["textbox", { name: "j_username" }],
    ]);
  });

  it("builds role-first username locators for WSL and Linux", () => {
    const { page, calls } = createPageMock();

    getUsernameField(page as never, { environment: "wsl" });

    expect(calls.map((call) => call.args)).toEqual([
      ["textbox", { name: "Username" }],
      ["textbox", { name: "j_username" }],
      ["#username"],
      ['input[name="j_username"]'],
    ]);
  });

  it("builds native-first password locators for Windows", () => {
    const { page, calls } = createPageMock();

    getPasswordField(page as never, { environment: "windows" });

    expect(calls.map((call) => call.args)).toEqual([
      ["#password"],
      ['input[name="j_password"]'],
      ["textbox", { name: "Password" }],
      ["textbox", { name: "密碼" }],
    ]);
  });

  it("prefers the native domain select before the combobox role on Windows", () => {
    const { page, calls } = createPageMock();

    getDomainSelector(page as never, { environment: "windows" });

    expect(calls.map((call) => call.args)).toEqual([
      ["#domain_select"],
      ['select[name="domain"]'],
      ["combobox", undefined],
    ]);
  });

  it("prefers the combobox role before the native domain select on WSL", () => {
    const { page, calls } = createPageMock();

    getDomainSelector(page as never, { environment: "wsl" });

    expect(calls.map((call) => call.args)).toEqual([
      ["combobox", undefined],
      ["#domain_select"],
      ['select[name="domain"]'],
    ]);
  });

  it("prefers the submit button id before the Log in role on Windows", () => {
    const { page, calls } = createPageMock();

    getLoginButton(page as never, { environment: "windows" });

    expect(calls.map((call) => call.args)).toEqual([
      ["#loginSDPage"],
      ['button[name="loginButton"]'],
      ["button", { name: "Log in" }],
    ]);
  });
});

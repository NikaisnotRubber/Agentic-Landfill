import { describe, expect, it, vi } from "vitest";

import {
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
  it("builds resilient username locators for Windows and Linux variants", () => {
    const { page, calls } = createPageMock();

    getUsernameField(page as never);

    expect(calls.map((call) => call.args)).toEqual([
      ["#username"],
      ['input[name="j_username"]'],
      ["textbox", { name: "Username" }],
      ["textbox", { name: "j_username" }],
    ]);
  });

  it("builds resilient password locators for Windows and Linux variants", () => {
    const { page, calls } = createPageMock();

    getPasswordField(page as never);

    expect(calls.map((call) => call.args)).toEqual([
      ["#password"],
      ['input[name="j_password"]'],
      ["textbox", { name: "Password" }],
      ["textbox", { name: "密碼" }],
    ]);
  });

  it("prefers the native domain select before the combobox role", () => {
    const { page, calls } = createPageMock();

    getDomainSelector(page as never);

    expect(calls.map((call) => call.args)).toEqual([
      ['select[name="domain"]'],
      ["combobox", undefined],
    ]);
  });

  it("prefers the submit button id before the Log in role", () => {
    const { page, calls } = createPageMock();

    getLoginButton(page as never);

    expect(calls.map((call) => call.args)).toEqual([
      ["#loginSDPage"],
      ["button", { name: "Log in" }],
    ]);
  });
});

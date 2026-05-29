import type { Page } from "playwright";

import type { HelpdeskAuthConfig } from "./helpdeskConfig";
import {
  getDomainSelector,
  getLoginButton,
  getPasswordField,
  getUsernameField,
} from "./helpdeskLocators";

export async function performHelpdeskLogin(
  page: Page,
  config: HelpdeskAuthConfig,
): Promise<void> {
  await page.goto(config.baseUrl, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });

  let usernameField;
  try {
    usernameField = getUsernameField(page);
    await usernameField.waitFor({ state: "visible", timeout: 15_000 });
  } catch {
    throw new Error("Username field not found");
  }

  let passwordField;
  try {
    passwordField = getPasswordField(page);
    await passwordField.waitFor({ state: "visible", timeout: 15_000 });
  } catch {
    throw new Error("Password field not found");
  }

  let domainSelector;
  try {
    domainSelector = getDomainSelector(page);
    await domainSelector.waitFor({ state: "visible", timeout: 15_000 });
  } catch {
    throw new Error("Domain selector not found");
  }

  let loginButton;
  try {
    loginButton = getLoginButton(page);
    await loginButton.waitFor({ state: "visible", timeout: 15_000 });
  } catch {
    throw new Error("Log in button not found");
  }

  await domainSelector.selectOption({ label: config.domain });
  await usernameField.fill(config.username);
  await passwordField.fill(config.password);
  await loginButton.click();
  await page.waitForLoadState("networkidle", { timeout: 60_000 });
}

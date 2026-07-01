import type { Page } from "playwright";

import type { HelpdeskAuthConfig } from "./helpdeskConfig";
import {
  detectHelpdeskAutomationEnvironment,
  getDomainSelector,
  getLoginButton,
  getPasswordField,
  getUsernameField,
} from "./helpdeskLocators";

export async function performHelpdeskLogin(
  page: Page,
  config: HelpdeskAuthConfig,
): Promise<void> {
  const locatorOptions = {
    environment: detectHelpdeskAutomationEnvironment(),
  };

  await page.goto(config.baseUrl, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });

  let usernameField;
  try {
    usernameField = getUsernameField(page, locatorOptions);
    await usernameField.waitFor({ state: "visible", timeout: 15_000 });
  } catch {
    throw new Error("Username field not found");
  }

  let passwordField;
  try {
    passwordField = getPasswordField(page, locatorOptions);
    await passwordField.waitFor({ state: "visible", timeout: 15_000 });
  } catch {
    throw new Error("Password field not found");
  }

  let domainSelector;
  try {
    domainSelector = getDomainSelector(page, locatorOptions);
    await domainSelector.waitFor({ state: "visible", timeout: 15_000 });
  } catch {
    throw new Error("Domain selector not found");
  }

  let loginButton;
  try {
    loginButton = getLoginButton(page, locatorOptions);
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

import os from "node:os";

import type { Locator, Page } from "playwright";

type NamedRoleOptions = {
  name: string;
};

export type HelpdeskAutomationEnvironment = "windows" | "wsl" | "linux";

type DetectHelpdeskAutomationEnvironmentArgs = {
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  release?: string;
};

type HelpdeskLocatorOptions = {
  environment?: HelpdeskAutomationEnvironment;
};

type LocatorFactory = (page: Page) => Locator;

export function detectHelpdeskAutomationEnvironment(
  args: DetectHelpdeskAutomationEnvironmentArgs = {},
): HelpdeskAutomationEnvironment {
  const env = args.env ?? process.env;
  const platform = args.platform ?? process.platform;
  const release = args.release ?? os.release();

  if (platform === "win32") {
    return "windows";
  }

  if (
    platform === "linux"
    && (env.WSL_DISTRO_NAME || env.WSL_INTEROP || /microsoft|wsl/i.test(release))
  ) {
    return "wsl";
  }

  return "linux";
}

function getRoleLocator(
  page: Page,
  role: "textbox" | "button" | "combobox",
  options?: NamedRoleOptions,
): Locator {
  if (role === "combobox") {
    return page.getByRole(role);
  }

  return page.getByRole(role, options);
}

function combineLocators(locators: Locator[]): Locator {
  const [first, ...rest] = locators;
  return rest.reduce((combined, next) => combined.or(next), first);
}

function getOrderedLocator(
  page: Page,
  nativeLocators: LocatorFactory[],
  semanticLocators: LocatorFactory[],
  options: HelpdeskLocatorOptions = {},
): Locator {
  const environment = options.environment ?? detectHelpdeskAutomationEnvironment();
  const orderedLocators =
    environment === "windows"
      ? [...nativeLocators, ...semanticLocators]
      : [...semanticLocators, ...nativeLocators];

  return combineLocators(orderedLocators.map((factory) => factory(page)));
}

export function getUsernameField(
  page: Page,
  options: HelpdeskLocatorOptions = {},
): Locator {
  return getOrderedLocator(
    page,
    [
      (target) => target.locator("#username"),
      (target) => target.locator('input[name="j_username"]'),
    ],
    [
      (target) => getRoleLocator(target, "textbox", { name: "Username" }),
      (target) => getRoleLocator(target, "textbox", { name: "j_username" }),
    ],
    options,
  );
}

export function getPasswordField(
  page: Page,
  options: HelpdeskLocatorOptions = {},
): Locator {
  return getOrderedLocator(
    page,
    [
      (target) => target.locator("#password"),
      (target) => target.locator('input[name="j_password"]'),
    ],
    [
      (target) => getRoleLocator(target, "textbox", { name: "Password" }),
      (target) => getRoleLocator(target, "textbox", { name: "密碼" }),
    ],
    options,
  );
}

export function getDomainSelector(
  page: Page,
  options: HelpdeskLocatorOptions = {},
): Locator {
  return getOrderedLocator(
    page,
    [
      (target) => target.locator("#domain_select"),
      (target) => target.locator('select[name="domain"]'),
    ],
    [(target) => getRoleLocator(target, "combobox")],
    options,
  );
}

export function getLoginButton(
  page: Page,
  options: HelpdeskLocatorOptions = {},
): Locator {
  return getOrderedLocator(
    page,
    [
      (target) => target.locator("#loginSDPage"),
      (target) => target.locator('button[name="loginButton"]'),
    ],
    [(target) => getRoleLocator(target, "button", { name: "Log in" })],
    options,
  );
}

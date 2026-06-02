import type { Locator, Page } from "playwright";

function firstMatching(...locators: Locator[]): Locator {
  return locators.slice(1).reduce(
    (combined, locator) => combined.or(locator),
    locators[0],
  );
}

export function getUsernameField(page: Page): Locator {
  return firstMatching(
    page.locator("#username"),
    page.locator('input[name="j_username"]'),
    page.getByRole("textbox", { name: "Username" }),
    page.getByRole("textbox", { name: "j_username" }),
  );
}

export function getPasswordField(page: Page): Locator {
  return firstMatching(
    page.locator("#password"),
    page.locator('input[name="j_password"]'),
    page.getByRole("textbox", { name: "Password" }),
    page.getByRole("textbox", { name: "密碼" }),
  );
}

export function getDomainSelector(page: Page): Locator {
  return firstMatching(
    page.locator('select[name="domain"]'),
    page.getByRole("combobox"),
  );
}

export function getLoginButton(page: Page): Locator {
  return firstMatching(
    page.locator("#loginSDPage"),
    page.getByRole("button", { name: "Log in" }),
  );
}

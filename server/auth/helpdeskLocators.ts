import type { Locator, Page } from "playwright";

type NamedRoleOptions = {
  name: string;
};

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

export function getUsernameField(page: Page): Locator {
  return getRoleLocator(page, "textbox", { name: "Username" });
}

export function getPasswordField(page: Page): Locator {
  return getRoleLocator(page, "textbox", { name: "Password" });
}

export function getDomainSelector(page: Page): Locator {
  return getRoleLocator(page, "combobox");
}

export function getLoginButton(page: Page): Locator {
  return getRoleLocator(page, "button", { name: "Log in" });
}

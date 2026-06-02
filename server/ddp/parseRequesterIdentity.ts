import { extractRequesterAccount } from "../ad/requesterParser";
import { parseFirstLastFromAdName } from "./parseAdName";

const REQUESTER_NAME_RE = /([A-Za-z0-9._-]+)\s+([\u4e00-\u9fff·•]{2,})$/;
const CHINESE_NAME_RE = /[\u4e00-\u9fff·•]{2,}/;
const MAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

export type RequesterIdentity = {
  adAccount: string;
  adName: string;
  mail: string;
};

function splitChineseName(chineseName: string): { firstName: string; lastName: string } {
  const trimmed = chineseName.trim();
  if (trimmed.length > 1) {
    return { firstName: trimmed.slice(1), lastName: trimmed.slice(0, 1) };
  }
  return { firstName: "", lastName: "" };
}

function splitNameFromAdAccount(adAccount: string): { firstName: string; lastName: string } {
  if (!adAccount.includes(".")) {
    return { firstName: "", lastName: "" };
  }

  const parts = adAccount.split(".").filter(Boolean);
  if (parts.length < 2) {
    return { firstName: "", lastName: "" };
  }

  return {
    firstName: (parts[0] ?? "").trim(),
    lastName: (parts[parts.length - 1] ?? "").trim(),
  };
}

export function parseRequesterIdentity(requester: string): RequesterIdentity {
  const normalized = requester.trim();
  if (!normalized) {
    return { adAccount: "", adName: "", mail: "" };
  }

  const mail = MAIL_RE.exec(normalized)?.[0] ?? "";
  const accountNameMatch = REQUESTER_NAME_RE.exec(normalized);
  if (accountNameMatch) {
    return {
      adAccount: accountNameMatch[1].trim(),
      adName: accountNameMatch[2].trim(),
      mail,
    };
  }

  const adAccount = extractRequesterAccount(normalized);
  const chinese = CHINESE_NAME_RE.exec(normalized)?.[0] ?? "";
  return { adAccount, adName: chinese, mail };
}

export function resolveFirstLastNameFromIdentity(
  adName: string,
  adAccount: string,
): { firstName: string; lastName: string } {
  const fromAdName = parseFirstLastFromAdName(adName);
  if (fromAdName.firstName || fromAdName.lastName) {
    return fromAdName;
  }

  if (adName && /[\u4e00-\u9fff]/.test(adName)) {
    return splitChineseName(adName);
  }

  return splitNameFromAdAccount(adAccount);
}

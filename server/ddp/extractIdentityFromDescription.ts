import { normalizeDescriptionText } from "./normalizeDescriptionText";

const MAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

const LABEL_VALUE_SUFFIX = String.raw`(?:\([^)]*\))?\)?\s*[:：]\s*`;

const AD_ACCOUNT_RE = new RegExp(
  `(?:使用者帳號|AD帳號|AD Account|Account name|帳號)${LABEL_VALUE_SUFFIX}([A-Za-z0-9._-]+)`,
  "i",
);

const ACCOUNT_BEFORE_LABEL_RE = /([A-Za-z0-9._-]+)\s*\(?帳號\)?/i;

const ACCOUNT_NAME_BLOCK_RE = new RegExp(
  `Account name\\s*\\)${LABEL_VALUE_SUFFIX}([A-Za-z0-9._-]+)(?:\\s+([\\u4e00-\\u9fff·•]{2,}?))?(?=\\s*(?:工號|電腦|所屬|ID\\b|Department))`,
  "i",
);

function trimAdNameChinese(name: string): string {
  return name.replace(/工號$/u, "").trim();
}

export type DescriptionIdentity = {
  adAccount: string;
  adName: string;
  mail: string;
};

export function extractMailFromText(text: string): string {
  const match = MAIL_RE.exec(text);
  return match?.[0] ?? "";
}

function readAdAccountFromNormalizedText(normalized: string): string {
  const accountBlock = ACCOUNT_NAME_BLOCK_RE.exec(normalized);
  if (accountBlock) {
    return accountBlock[1].trim();
  }

  const labeled = AD_ACCOUNT_RE.exec(normalized);
  if (labeled) {
    return labeled[1].trim();
  }

  const beforeLabel = ACCOUNT_BEFORE_LABEL_RE.exec(normalized);
  if (beforeLabel) {
    return beforeLabel[1].trim();
  }

  return "";
}

export function extractAdAccountFromDescription(text: string): string {
  if (!text) {
    return "";
  }

  return readAdAccountFromNormalizedText(normalizeDescriptionText(text));
}

export function extractIdentityFromDescription(text: string): DescriptionIdentity {
  if (!text) {
    return { adAccount: "", adName: "", mail: "" };
  }

  const normalized = normalizeDescriptionText(text);
  const accountBlock = ACCOUNT_NAME_BLOCK_RE.exec(normalized);
  if (accountBlock) {
    return {
      adAccount: accountBlock[1].trim(),
      adName: trimAdNameChinese(accountBlock[2]?.trim() ?? ""),
      mail: extractMailFromText(normalized),
    };
  }

  return {
    adAccount: readAdAccountFromNormalizedText(normalized),
    adName: "",
    mail: extractMailFromText(normalized),
  };
}

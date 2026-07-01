import { TextDecoder } from "node:util";

export type NormalizedAdEntry = {
  adAccount: string;
  displayName: string;
  mail: string;
  department: string;
  manager: string;
  managerDn: string;
  employeeId: string;
  bg: string;
  bu: string;
};

export type ParsedAdDisplayName = {
  englishName: string;
  chineseName: string;
};

const HAN_RE = /\p{Script=Han}/u;
const UNREADABLE_NAME_RE = /[\p{Script=Han}\uFFFD]/u;

function decodeLdapString(value: string): string {
  if (!/[\u0080-\u00ff]/.test(value) || HAN_RE.test(value)) {
    return value;
  }

  const bytes: number[] = [];
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint > 0xff) {
      return value;
    }
    bytes.push(codePoint);
  }

  const decoded = Buffer.from(bytes).toString("utf8");
  return HAN_RE.test(decoded) && !decoded.includes("\uFFFD")
    ? decoded
    : value;
}

function decodeBig5Buffer(value: Buffer): string | null {
  try {
    return new TextDecoder("big5").decode(value);
  } catch {
    return null;
  }
}

function scoreDecodedLdapText(value: string): number {
  return (HAN_RE.test(value) ? 20 : 0)
    - (value.includes("\uFFFD") ? 50 : 0)
    - (value.includes("\0") ? 20 : 0);
}

function decodeLdapBuffer(value: Buffer): string {
  const hasUtf16NullPattern = value.length > 2 && value.filter((byte) => byte === 0).length / value.length > 0.2;
  if (hasUtf16NullPattern) {
    return value.toString("utf16le");
  }

  const utf8 = decodeLdapString(value.toString("utf8"));
  const big5 = decodeBig5Buffer(value);
  if (!big5) {
    return utf8;
  }

  return scoreDecodedLdapText(big5) > scoreDecodedLdapText(utf8) ? big5 : utf8;
}

function readString(entry: Record<string, unknown>, key: string): string {
  const value = entry[key];
  if (typeof value === "string") {
    return decodeLdapString(value);
  }

  if (Buffer.isBuffer(value)) {
    return decodeLdapBuffer(value);
  }

  if (Array.isArray(value)) {
    const [firstValue] = value;
    if (typeof firstValue === "string") {
      return decodeLdapString(firstValue);
    }
    if (Buffer.isBuffer(firstValue)) {
      return decodeLdapBuffer(firstValue);
    }
  }

  return "";
}

function extractCn(distinguishedName: string): string {
  const match = /CN=([^,]+)/i.exec(distinguishedName);
  return match?.[1] ?? distinguishedName;
}

function trimSlashValue(value: string): string {
  if (!value) {
    return "";
  }

  return value.includes("/") ? value.split("/")[0] : value;
}

export function normalizeAdAccountToken(token: string, rest = ""): string {
  const trimmedToken = token.trim();
  if (/^[A-Za-z]+(?:[._-][A-Za-z]+)+\d$/.test(trimmedToken) && UNREADABLE_NAME_RE.test(rest)) {
    return trimmedToken.slice(0, -1);
  }
  return trimmedToken;
}

function extractLeadingAdAccount(value: string): { account: string; consumed: number } {
  const match = /^[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)+/.exec(value);
  const token = match?.[0] ?? "";
  const rest = token ? value.slice(token.length) : "";
  return { account: normalizeAdAccountToken(token, rest), consumed: token.length };
}

export function parseAdDisplayName(displayName: string): ParsedAdDisplayName {
  const normalized = displayName.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return { englishName: "", chineseName: "" };
  }

  const leadingAccount = extractLeadingAdAccount(normalized);
  if (leadingAccount.account) {
    return {
      englishName: leadingAccount.account,
      chineseName: normalized.slice(leadingAccount.consumed).trim().replace(/\s+/g, ""),
    };
  }

  const firstChineseIndex = normalized.search(/\p{Script=Han}/u);
  if (firstChineseIndex < 0) {
    return { englishName: normalized, chineseName: "" };
  }

  return {
    englishName: normalized.slice(0, firstChineseIndex).trim(),
    chineseName: normalized.slice(firstChineseIndex).replace(/\s+/g, ""),
  };
}

export function resolveAdChineseName(displayName: string): string {
  const { chineseName, englishName } = parseAdDisplayName(displayName);
  return chineseName || englishName;
}

export function resolveAdEnglishName(displayName: string): string {
  return parseAdDisplayName(displayName).englishName;
}

export function normalizeAdEntry(entry: Record<string, unknown>): NormalizedAdEntry {
  const managerValue = readString(entry, "manager");

  return {
    adAccount: readString(entry, "sAMAccountName"),
    displayName: readString(entry, "cn"),
    mail: readString(entry, "mail"),
    department: readString(entry, "department"),
    manager: managerValue.includes("CN=") ? extractCn(managerValue) : managerValue,
    managerDn: managerValue.includes("CN=") ? managerValue : "",
    employeeId: readString(entry, "extensionAttribute15"),
    bg: trimSlashValue(readString(entry, "extensionAttribute1")),
    bu: trimSlashValue(readString(entry, "extensionAttribute2")),
  };
}

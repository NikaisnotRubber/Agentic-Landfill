const REQUESTER_ACCOUNT_NAME_RE =
  /([A-Za-z0-9._-]+)\s+([\u4e00-\u9fff·•]{2,})$/;

const SAM_ACCOUNT_RE = /^[A-Za-z0-9._-]+$/;

export function extractRequesterAccount(requester: string): string {
  const normalized = requester.trim();
  if (!normalized) {
    return "";
  }

  const accountNameMatch = REQUESTER_ACCOUNT_NAME_RE.exec(normalized);
  if (accountNameMatch) {
    return accountNameMatch[1].trim();
  }

  const parts = normalized.split(/\s+/);
  for (const part of parts) {
    if (SAM_ACCOUNT_RE.test(part)) {
      return part;
    }
  }

  return parts[0]?.trim() ?? "";
}

export function looksLikeSamAccountName(value: string): boolean {
  return SAM_ACCOUNT_RE.test(value.trim());
}

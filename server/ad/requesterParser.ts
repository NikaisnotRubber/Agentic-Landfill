export function extractRequesterAccount(requester: string): string {
  const normalized = requester.trim();
  if (!normalized) {
    return "";
  }

  const [account = ""] = normalized.split(/\s+/);
  return account;
}

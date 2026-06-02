export function normalizeAdAccount(account: string): string {
  return account.trim().toUpperCase();
}

export function resolveMemberMail(adAccount: string, mail: string): string {
  const trimmed = mail.trim();
  if (trimmed) {
    return trimmed.toLowerCase();
  }
  return adAccount ? `${normalizeAdAccount(adAccount)}@deltaww.com`.toLowerCase() : "";
}

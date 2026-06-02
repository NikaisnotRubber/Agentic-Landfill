/**
 * Repairs display strings when UTF-8 bytes were interpreted as Latin-1 (common in LDAP/PowerShell paths).
 * Only returns repaired text when the result contains CJK characters.
 */
export function repairMojibakeText(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || /[\u4e00-\u9fff]/.test(trimmed)) {
    return value;
  }

  if (!/[\u0080-\u00ff]/.test(trimmed)) {
    return value;
  }

  try {
    const bytes = Uint8Array.from(trimmed, (char) => char.charCodeAt(0) & 0xff);
    const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    if (/[\u4e00-\u9fff]/.test(decoded)) {
      return decoded;
    }
  } catch {
    return value;
  }

  return value;
}

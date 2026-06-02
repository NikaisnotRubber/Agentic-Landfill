/** Latin given + family segments in an AD display name (cn), before ignored trailing text. */
const AD_NAME_LATIN_PREFIX_RE = /^([A-Za-z0-9][A-Za-z0-9._-]*)(?:\s+.*)?$/;

function splitDottedLatinAccount(latin: string): { firstName: string; lastName: string } {
  if (!latin.includes(".")) {
    return { firstName: "", lastName: "" };
  }

  const parts = latin.split(".").filter(Boolean);
  if (parts.length < 2) {
    return { firstName: "", lastName: "" };
  }

  return {
    firstName: (parts[0] ?? "").trim(),
    lastName: (parts[parts.length - 1] ?? "").trim(),
  };
}

/**
 * Parse Processed DDP First / Last name from AD Name (`displayName`).
 * Pattern: `{FirstName}.{LastName} {ignored remainder}` — only the leading Latin
 * `First.Last` token (additional dots → middle segments) is used; text after the
 * first whitespace is ignored (e.g. Chinese cn suffix).
 */
export function parseFirstLastFromAdName(adName: string): {
  firstName: string;
  lastName: string;
} {
  const trimmed = adName.trim();
  if (!trimmed) {
    return { firstName: "", lastName: "" };
  }

  const match = AD_NAME_LATIN_PREFIX_RE.exec(trimmed);
  if (!match) {
    return { firstName: "", lastName: "" };
  }

  return splitDottedLatinAccount(match[1]);
}

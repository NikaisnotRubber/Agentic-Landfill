import { normalizeAdAccountToken } from "../ad/normalizeAdEntry";
import { extractRequesterAccount } from "../ad/requesterParser";
import type { TicketRecord } from "../types";
import type { HelpdeskVmTicketParseResult } from "./types";

const ACCOUNT_RE =
  /(?:使用者帳號|AD帳號|AD Account|帳號)[:：\s]*([A-Za-z0-9._-]+)/i;
const USER_ROLE_RE = /職系[:：\s]*([^\s,，;；\n\r]+)/i;

function extractDescriptionAccount(description: string): string {
  const match = ACCOUNT_RE.exec(description);
  if (!match?.[1]) {
    return "";
  }

  const token = match[1].trim();
  return normalizeAdAccountToken(token, description.slice((match.index ?? 0) + match[0].length));
}

function extractUserRole(description: string): string {
  const match = USER_ROLE_RE.exec(description);
  return match?.[1]?.trim() ?? "";
}

export function parseHelpdeskTicketForVmSync(
  ticket: TicketRecord,
): HelpdeskVmTicketParseResult {
  const description = ticket.short_description ?? "";
  const adName = extractDescriptionAccount(description) || extractRequesterAccount(ticket.requester);

  if (!adName) {
    return {
      ok: false,
      ticketId: ticket.id,
      reason: "missing-ad-name",
    };
  }

  return {
    ok: true,
    ticketId: ticket.id,
    adName,
    userRole: extractUserRole(description),
  };
}

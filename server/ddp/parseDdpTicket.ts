import type { TicketRecord } from "../types";
import type { ProcessedDdpRow } from "./types";

const NB_HOSTNAME_LENGTH = 11;

const INVALID_VM_HOSTNAMES = new Set([
  "hostname",
  "localhost",
  "127.0.0.1",
  "vm",
  "none",
  "na",
  "n/a",
  "tbd",
  "-",
  "host",
]);

const AD_ACCOUNT_RE =
  /(?:使用者帳號|AD帳號|AD Account|帳號)[:：\s]*([A-Za-z0-9._-]+)/i;
const MAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const NB_HOST_RE =
  /(?:使用者電腦名稱|筆電電腦名稱|NB Hostname|電腦名稱|電腦編號(?:\s*\(NB\))?)[:：\s]*([A-Za-z0-9.-]+)/i;
const VM_HOST_RE =
  /(?:VM HostName|連線 DDP 主機名稱|VM 主機名稱|Connect VM|主管或同仁的連線主機|遠端機器|VM)[:：\s]*([A-Za-z0-9.-]+)/i;

type ParsedFields = {
  adAccount: string;
  adName: string;
  firstName: string;
  lastName: string;
  mail: string;
  nbHostname: string;
  vmHostname: string;
};

function extractMail(text: string): string {
  const match = MAIL_RE.exec(text);
  return match ? match[0] : "";
}

function extractAdAccount(text: string): string {
  const match = AD_ACCOUNT_RE.exec(text);
  return match ? match[1].trim() : "";
}

function splitNameFromAd(adAccount: string): { firstName: string; lastName: string } {
  if (adAccount && adAccount.includes(".")) {
    const parts = adAccount.split(".");
    return {
      firstName: parts[0]?.trim().replace(/\b\w/g, (char) => char.toUpperCase()) ?? "",
      lastName: parts[parts.length - 1]?.trim().replace(/\b\w/g, (char) => char.toUpperCase()) ?? "",
    };
  }
  return { firstName: "", lastName: "" };
}

function splitChineseName(chineseName: string): { firstName: string; lastName: string } {
  if (chineseName && chineseName.length > 1) {
    return { firstName: chineseName.slice(1), lastName: chineseName[0] };
  }
  return { firstName: "", lastName: "" };
}

function parseRequester(requesterText: string): {
  adAccount: string;
  adName: string;
  mail: string;
} {
  const normalized = requesterText.trim();
  const out = { adAccount: "", adName: "", mail: "" };
  if (!normalized) {
    return out;
  }

  out.mail = extractMail(normalized);

  const accountNameMatch = /([A-Za-z0-9._-]+)\s+([\u4e00-\u9fff·•]{2,})$/.exec(normalized);
  if (accountNameMatch) {
    out.adAccount = accountNameMatch[1].trim();
    out.adName = accountNameMatch[2].trim();
    return out;
  }

  const parts = normalized.split(/\s+/);
  if (parts[0]) {
    out.adAccount = parts[0].trim();
  }
  const chinese = /[\u4e00-\u9fff·•]{2,}/.exec(normalized);
  if (chinese) {
    out.adName = chinese[0];
  }
  return out;
}

function normalizeText(text: string): string {
  let normalized = text.replace(/\n/g, " ");
  normalized = normalized.replace(/：/g, ":");
  normalized = normalized.replace(/(?<![A-Za-z0-9])(\d+)\.(?![A-Za-z0-9])/g, " $1. ");
  normalized = normalized.replace(/([\u4e00-\u9fff])([A-Za-z0-9])/g, "$1 $2");
  normalized = normalized.replace(/([A-Za-z0-9])([\u4e00-\u9fff])/g, "$1 $2");
  return normalized;
}

function extractFromText(text: string): ParsedFields {
  const out: ParsedFields = {
    adAccount: "",
    adName: "",
    firstName: "",
    lastName: "",
    mail: "",
    nbHostname: "",
    vmHostname: "",
  };

  if (!text) {
    return out;
  }

  const normalized = normalizeText(text);
  out.adAccount = extractAdAccount(normalized);
  out.mail = extractMail(normalized);

  const nbMatch = NB_HOST_RE.exec(normalized);
  if (nbMatch) {
    const nbValue = nbMatch[1].trim().replace(/[.,;:\\]+$/, "");
    out.nbHostname =
      nbValue.length >= NB_HOSTNAME_LENGTH ? nbValue.slice(0, NB_HOSTNAME_LENGTH) : nbValue;
  }

  const vmMatch = VM_HOST_RE.exec(normalized);
  if (vmMatch) {
    out.vmHostname = vmMatch[1].trim().replace(/[.,;:\\]+$/, "");
  }

  if (!out.adAccount) {
    const accountFallback = /([A-Za-z0-9._-]+)\s*\(?帳號\)?/.exec(normalized);
    if (accountFallback) {
      out.adAccount = accountFallback[1];
    }
  }

  return out;
}

function buildAbnormalFlags(parsed: ParsedFields, hadInvalidVm: boolean): string[] {
  const flags: string[] = [];
  if (!parsed.adAccount) {
    flags.push("missing-ad-account");
  }
  if (!parsed.nbHostname) {
    flags.push("missing-nb-hostname");
  }
  if (!parsed.vmHostname) {
    flags.push("missing-vm-hostname");
  }
  if (hadInvalidVm) {
    flags.push("invalid-vm-hostname");
  }
  return flags;
}

export function parseDdpTicket(ticket: TicketRecord, isNewTicket = false): ProcessedDdpRow {
  const description = ticket.short_description ?? "";
  const parsed = extractFromText(description);
  const requesterData = parseRequester(ticket.requester ?? "");
  const requesterAd = requesterData.adAccount;
  const descLower = description.toLowerCase();
  const enrichedAd = ticket.ad;

  if (requesterAd) {
    const requesterMatch =
      descLower.includes(requesterAd.toLowerCase())
      || parsed.adAccount.toLowerCase() === requesterAd.toLowerCase();
    if (requesterMatch) {
      parsed.adAccount = requesterData.adAccount;
      if (requesterData.adName) {
        parsed.adName = requesterData.adName;
      }
      if (requesterData.mail) {
        parsed.mail = requesterData.mail;
      }
    }
  }

  if (enrichedAd?.adAccount) {
    parsed.adAccount = enrichedAd.adAccount;
    parsed.adName = enrichedAd.displayName || parsed.adName;
    parsed.mail = enrichedAd.mail || parsed.mail;
  }

  if (parsed.adName) {
    const nameParts = splitChineseName(parsed.adName);
    parsed.firstName = nameParts.firstName;
    parsed.lastName = nameParts.lastName;
  } else {
    const nameParts = splitNameFromAd(parsed.adAccount);
    parsed.firstName = nameParts.firstName;
    parsed.lastName = nameParts.lastName;
  }

  if (!parsed.mail && parsed.adAccount) {
    parsed.mail = `${parsed.adAccount}@deltaww.com`;
  }

  let hadInvalidVm = false;
  const vmValue = parsed.vmHostname;
  if (vmValue && INVALID_VM_HOSTNAMES.has(vmValue.toLowerCase())) {
    hadInvalidVm = true;
    parsed.vmHostname = "";
  }

  const abnormalFlags = buildAbnormalFlags(parsed, hadInvalidVm);

  return {
    ticketId: ticket.id,
    status: ticket.status,
    subject: ticket.subject,
    requester: ticket.requester,
    isNewTicket,
    adAccount: parsed.adAccount,
    adName: parsed.adName,
    firstName: parsed.firstName,
    lastName: parsed.lastName,
    mail: parsed.mail,
    bu: enrichedAd?.bu ?? "",
    nbHostname: parsed.nbHostname,
    vmHostname: parsed.vmHostname,
    role: "",
    application: "",
    userRoles: "",
    abnormalFlags,
  };
}

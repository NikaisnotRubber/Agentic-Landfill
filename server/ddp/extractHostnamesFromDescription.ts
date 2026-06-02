import { normalizeDescriptionText } from "./normalizeDescriptionText";

export const NB_HOSTNAME_LENGTH = 11;

export const INVALID_VM_HOSTNAMES = new Set([
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

const LABEL_VALUE_SUFFIX = String.raw`(?:\([^)]*\))?\)?\s*[:：]\s*`;

const NB_HOST_RE = new RegExp(
  `(?:使用者電腦名稱|筆電電腦名稱|NB Hostname|電腦名稱|電腦編號(?:\\s*\\(NB\\))?)${LABEL_VALUE_SUFFIX}([A-Za-z0-9.-]+)`,
  "i",
);

const VM_HOST_RE = new RegExp(
  `(?:VM HostName|連線 DDP 主機名稱|VM 主機名稱|Connect VM|主管或同仁的連線主機|遠端機器|VM)${LABEL_VALUE_SUFFIX}([A-Za-z0-9.-]+)`,
  "i",
);

export type ExtractedHostnames = {
  nbHostname: string;
  vmHostname: string;
  hadInvalidVm: boolean;
};

function trimHostnameValue(value: string): string {
  return value.trim().replace(/[.,;:\\]+$/, "");
}

export function extractHostnamesFromDescription(text: string): ExtractedHostnames {
  const out: ExtractedHostnames = {
    nbHostname: "",
    vmHostname: "",
    hadInvalidVm: false,
  };

  if (!text) {
    return out;
  }

  const normalized = normalizeDescriptionText(text);

  const nbMatch = NB_HOST_RE.exec(normalized);
  if (nbMatch) {
    const nbValue = trimHostnameValue(nbMatch[1]);
    out.nbHostname =
      nbValue.length >= NB_HOSTNAME_LENGTH ? nbValue.slice(0, NB_HOSTNAME_LENGTH) : nbValue;
  }

  const vmMatch = VM_HOST_RE.exec(normalized);
  if (vmMatch) {
    const vmValue = trimHostnameValue(vmMatch[1]);
    if (INVALID_VM_HOSTNAMES.has(vmValue.toLowerCase())) {
      out.hadInvalidVm = true;
    } else {
      out.vmHostname = vmValue;
    }
  }

  return out;
}

/** Raw VM label value when it matches INVALID_VM_HOSTNAMES (for Excel abnormal message). */
export function findInvalidVmValueInDescription(text: string): string {
  if (!text) {
    return "";
  }

  const normalized = normalizeDescriptionText(text);
  const vmMatch = VM_HOST_RE.exec(normalized);
  if (!vmMatch) {
    return "";
  }

  const vmValue = trimHostnameValue(vmMatch[1]);
  return INVALID_VM_HOSTNAMES.has(vmValue.toLowerCase()) ? vmValue : "";
}

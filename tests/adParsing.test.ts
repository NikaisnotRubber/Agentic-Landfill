import { describe, expect, it } from "vitest";

import { normalizeAdEntry } from "../server/ad/normalizeAdEntry";
import { extractRequesterAccount } from "../server/ad/requesterParser";

describe("extractRequesterAccount", () => {
  it("returns the first token from a standard requester string", () => {
    expect(extractRequesterAccount("JIAHUA.WU 吳家驊")).toBe("JIAHUA.WU");
  });

  it("returns an empty string for blank requester values", () => {
    expect(extractRequesterAccount("")).toBe("");
  });

  it("trims leading and trailing whitespace before extracting the account", () => {
    expect(extractRequesterAccount("  JIAHUA.WU   吳家驊  ")).toBe("JIAHUA.WU");
  });
});

describe("normalizeAdEntry", () => {
  it("reduces manager DN and trims BG/BU suffixes", () => {
    expect(
      normalizeAdEntry({
        sAMAccountName: "JIAHUA.WU",
        cn: "吳家驊",
        mail: "jiahua.wu@deltaww.com",
        department: "Infra",
        manager: "CN=王小明,OU=Users,DC=delta,DC=corp",
        extensionAttribute15: "123456",
        extensionAttribute1: "LTW/Infra",
        extensionAttribute2: "IT/Support",
      }),
    ).toMatchObject({
      adAccount: "JIAHUA.WU",
      displayName: "吳家驊",
      mail: "jiahua.wu@deltaww.com",
      department: "Infra",
      manager: "王小明",
      employeeId: "123456",
      bg: "LTW",
      bu: "IT",
    });
    expect(
      normalizeAdEntry({
        manager: "CN=????OU=Users,DC=delta,DC=corp",
      }).managerDn,
    ).toContain("OU=Users,DC=delta,DC=corp");
  });

  it("normalizes missing values to empty strings", () => {
    expect(normalizeAdEntry({})).toEqual({
      adAccount: "",
      displayName: "",
      mail: "",
      department: "",
      manager: "",
      managerDn: "",
      employeeId: "",
      bg: "",
      bu: "",
    });
  });

  it("keeps manager DN for manager account lookup", () => {
    expect(
      normalizeAdEntry({
        sAMAccountName: "JIAHUA.WU",
        cn: "吳家驊",
        manager: "CN=LEO.ZOU,OU=Users,DC=delta,DC=corp",
        managerSamAccountName: "LEO.ZOU",
      }),
    ).toMatchObject({
      manager: "LEO.ZOU",
      managerDn: "CN=LEO.ZOU,OU=Users,DC=delta,DC=corp",
    });
  });
});

import { describe, expect, it } from "vitest";

import {
  normalizeAdEntry,
  parseAdDisplayName,
  resolveAdChineseName,
  resolveAdEnglishName,
} from "../server/ad/normalizeAdEntry";

describe("normalizeAdEntry", () => {
  it("decodes LDAP string attributes when UTF-8 bytes were read as Latin-1", () => {
    const displayName = "LEO.ZOU 鄒皓年";
    const mojibakeDisplayName = Buffer.from(displayName, "utf8").toString("latin1");

    expect(
      normalizeAdEntry({
        sAMAccountName: "LEO.ZOU",
        cn: mojibakeDisplayName,
      }).displayName,
    ).toBe(displayName);
  });

  it("decodes LDAP Buffer attributes as UTF-8", () => {
    expect(
      normalizeAdEntry({
        sAMAccountName: Buffer.from("JIAHUA.WU", "utf8"),
        cn: Buffer.from("JIAHUA.WU 吳家驊", "utf8"),
      }),
    ).toMatchObject({
      adAccount: "JIAHUA.WU",
      displayName: "JIAHUA.WU 吳家驊",
    });
  });

  it("decodes manager DN before extracting CN", () => {
    const managerDn = "CN=LEO.ZOU 鄒皓年,OU=Users,DC=delta,DC=corp";
    const mojibakeManagerDn = Buffer.from(managerDn, "utf8").toString("latin1");

    expect(
      normalizeAdEntry({
        manager: mojibakeManagerDn,
      }),
    ).toMatchObject({
      manager: "LEO.ZOU 鄒皓年",
      managerDn,
    });
  });
});

describe("AD account token parser", () => {
  it("parses UNO.CHEN full name into stable English and Chinese parts", () => {
    expect(parseAdDisplayName("UNO.CHEN \u9673\u653f\u5609")).toEqual({
      englishName: "UNO.CHEN",
      chineseName: "\u9673\u653f\u5609",
    });
  });

  it("decodes UNO.CHEN full name when LDAP returns UTF-16LE bytes", () => {
    const displayName = "UNO.CHEN \u9673\u653f\u5609";

    expect(
      normalizeAdEntry({
        sAMAccountName: "UNO.CHEN",
        cn: Buffer.from(displayName, "utf16le"),
      }).displayName,
    ).toBe(displayName);
  });

  it("decodes UNO.CHEN full name when LDAP returns Big5 bytes", () => {
    const displayName = "UNO.CHEN \u9673\u653f\u5609";

    expect(
      normalizeAdEntry({
        sAMAccountName: "UNO.CHEN",
        cn: Buffer.from("554e4f2e4348454e20b3afac46b9c5", "hex"),
      }).displayName,
    ).toBe(displayName);
  });

  it("decodes Big5-only Chinese names from LDAP buffers", () => {
    expect(
      normalizeAdEntry({
        cn: Buffer.from("bc42a46cbba8", "hex"),
      }).displayName,
    ).toBe("\u5289\u5b50\u8c6a");
  });

  it("drops a single digit that was decoded onto the end of a name token", () => {
    expect(parseAdDisplayName("UNO.CHEN2 \u9673\u653f\u5609")).toEqual({
      englishName: "UNO.CHEN",
      chineseName: "\u9673\u653f\u5609",
    });
  });

  it("uses only the leading AD account when REPORT_TO contains unreadable Chinese text", () => {
    expect(resolveAdEnglishName("NICK.CY.LI ������")).toBe("NICK.CY.LI");
  });

  it("does not attach trailing display-name noise to the AD account", () => {
    expect(parseAdDisplayName("ANNA.SY.LEE 李小美2").englishName).toBe("ANNA.SY.LEE");
  });
});

describe("AD display name parser", () => {
  it("splits English and Chinese portions from LDAP display names", () => {
    expect(parseAdDisplayName("LEO.ZOU 鄒皓年")).toEqual({
      englishName: "LEO.ZOU",
      chineseName: "鄒皓年",
    });
  });

  it("uses Chinese-only values for CHN_NAME and falls back to English when Chinese is missing", () => {
    expect(resolveAdChineseName("LEO.ZOU 鄒皓年")).toBe("鄒皓年");
    expect(resolveAdChineseName("LEO.ZOU")).toBe("LEO.ZOU");
  });

  it("uses only the English portion for REPORT_TO fallback", () => {
    expect(resolveAdEnglishName("LEO.ZOU 鄒皓年")).toBe("LEO.ZOU");
    expect(resolveAdEnglishName("鄒皓年")).toBe("");
  });
});

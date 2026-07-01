import { describe, expect, it } from "vitest";

import { parseWindowsIntegratedLookupOutput } from "../server/ad/windowsIntegratedLookup";

function psString(value: string): string {
  return Buffer.from(value, "utf16le").toString("base64");
}

describe("parseWindowsIntegratedLookupOutput", () => {
  it("decodes PowerShell-safe UTF-16LE base64 LDAP values", () => {
    expect(
      parseWindowsIntegratedLookupOutput(
        JSON.stringify({
          __encoding: "utf16le-base64",
          sAMAccountName: psString("UNO.CHEN"),
          cn: psString("UNO.CHEN \u9673\u653f\u5609"),
          manager: psString("CN=NICK.CY.LI \u5289\u5b50\u8c6a,OU=Users,DC=delta,DC=corp"),
        }),
      ),
    ).toMatchObject({
      adAccount: "UNO.CHEN",
      displayName: "UNO.CHEN \u9673\u653f\u5609",
      manager: "NICK.CY.LI \u5289\u5b50\u8c6a",
      managerDn: "CN=NICK.CY.LI \u5289\u5b50\u8c6a,OU=Users,DC=delta,DC=corp",
    });
  });

  it("returns null for empty integrated lookup results", () => {
    expect(parseWindowsIntegratedLookupOutput("{}")).toBeNull();
  });
});

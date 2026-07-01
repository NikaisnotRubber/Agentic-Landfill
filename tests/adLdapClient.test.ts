import { describe, expect, it, vi } from "vitest";

import { createAdLookupClient } from "../server/ad/ldapClient";

describe("createAdLookupClient", () => {
  it("uses simple bind when credentials are configured", async () => {
    const bind = vi.fn().mockResolvedValue(undefined);
    const search = vi.fn().mockResolvedValue({
      searchEntries: [{ sAMAccountName: "JIAHUA.WU", cn: "吳家驊" }],
    });
    const unbind = vi.fn().mockResolvedValue(undefined);

    const client = createAdLookupClient({
      env: {
        AD_DC: "twtpedcs02",
        AD_BASE_DN: "DC=delta,DC=corp",
        AD_USER: "DELTA\\svc_account",
        AD_PASSWORD: "secret",
      },
      platform: "linux",
      ldapFactory: () => ({
        bind,
        search,
        unbind,
      }),
      runIntegratedLookup: vi.fn(),
    });

    const result = await client.lookupUser("JIAHUA.WU");

    expect(bind).toHaveBeenCalledWith("DELTA\\svc_account", "secret");
    expect(search).toHaveBeenCalledWith("DC=delta,DC=corp", {
      scope: "sub",
      filter: "(sAMAccountName=JIAHUA.WU)",
      attributes: [
        "sAMAccountName",
        "cn",
        "mail",
        "department",
        "manager",
        "extensionAttribute15",
        "extensionAttribute1",
        "extensionAttribute2",
      ],
      explicitBufferAttributes: ["cn", "manager"],
    });
    expect(result?.displayName).toBe("吳家驊");

    await client.close();
    expect(unbind).toHaveBeenCalledTimes(1);
  });

  it("prefers integrated lookup on win32 when it succeeds", async () => {
    const runIntegratedLookup = vi.fn().mockResolvedValue({
      adAccount: "JIAHUA.WU",
      displayName: "吳家驊",
      mail: "",
      department: "",
      manager: "",
      managerAccount: "",
      employeeId: "",
      bg: "",
      bu: "",
    });
    const ldapFactory = vi.fn();

    const client = createAdLookupClient({
      env: {
        AD_DC: "twtpedcs02",
        AD_BASE_DN: "DC=delta,DC=corp",
        AD_USER: "DELTA\\svc_account",
        AD_PASSWORD: "secret",
      },
      platform: "win32",
      ldapFactory,
      runIntegratedLookup,
    });

    const result = await client.lookupUser("JIAHUA.WU");

    expect(runIntegratedLookup).toHaveBeenCalledWith({
      account: "JIAHUA.WU",
      dcHost: "twtpedcs02",
      baseDn: "DC=delta,DC=corp",
    });
    expect(ldapFactory).not.toHaveBeenCalled();
    expect(result?.displayName).toBe("吳家驊");
  });

  it("falls back to simple bind when integrated lookup fails and credentials exist", async () => {
    const runIntegratedLookup = vi.fn().mockRejectedValue(new Error("kerberos failed"));
    const bind = vi.fn().mockResolvedValue(undefined);
    const search = vi.fn().mockResolvedValue({
      searchEntries: [{ sAMAccountName: "JIAHUA.WU", cn: "吳家驊" }],
    });

    const client = createAdLookupClient({
      env: {
        AD_DC: "twtpedcs02",
        AD_BASE_DN: "DC=delta,DC=corp",
        AD_USER: "DELTA\\svc_account",
        AD_PASSWORD: "secret",
      },
      platform: "win32",
      ldapFactory: () => ({
        bind,
        search,
        unbind: vi.fn().mockResolvedValue(undefined),
      }),
      runIntegratedLookup,
    });

    const result = await client.lookupUser("JIAHUA.WU");

    expect(runIntegratedLookup).toHaveBeenCalledTimes(1);
    expect(bind).toHaveBeenCalledTimes(1);
    expect(result?.adAccount).toBe("JIAHUA.WU");
  });

  it("throws a clear error when no supported auth path is configured", async () => {
    const client = createAdLookupClient({
      env: {
        AD_DC: "twtpedcs02",
        AD_BASE_DN: "DC=delta,DC=corp",
      },
      platform: "linux",
      ldapFactory: vi.fn(),
      runIntegratedLookup: vi.fn(),
    });

    await expect(client.lookupUser("JIAHUA.WU")).rejects.toThrow(
      "No supported LDAP authentication method is configured.",
    );
  });
});

import { describe, expect, it, vi } from "vitest";

import {
  enrichEntryWithManagerAccount,
  managerDnFilter,
} from "../server/ad/resolveManagerSamAccount";

describe("managerDnFilter", () => {
  it("builds a distinguishedName LDAP filter with escaped characters", () => {
    expect(managerDnFilter("CN=LEO.ZOU,OU=Users,DC=delta,DC=corp")).toBe(
      "(distinguishedName=CN=LEO.ZOU,OU=Users,DC=delta,DC=corp)",
    );
  });
});

describe("enrichEntryWithManagerAccount", () => {
  it("resolves manager sAMAccountName when manager is a DN", async () => {
    const searchByFilter = vi.fn().mockResolvedValue({
      sAMAccountName: "LEO.ZOU",
    });

    const enriched = await enrichEntryWithManagerAccount(searchByFilter, {
      sAMAccountName: "JIAHUA.WU",
      manager: "CN=LEO.ZOU,OU=Users,DC=delta,DC=corp",
    });

    expect(searchByFilter).toHaveBeenCalledWith(
      "(distinguishedName=CN=LEO.ZOU,OU=Users,DC=delta,DC=corp)",
    );
    expect(enriched.managerSamAccountName).toBe("LEO.ZOU");
  });

  it("returns the original entry when manager is missing or not a DN", async () => {
    const searchByFilter = vi.fn();

    const withoutManager = await enrichEntryWithManagerAccount(searchByFilter, {
      sAMAccountName: "JIAHUA.WU",
    });
    const plainManager = await enrichEntryWithManagerAccount(searchByFilter, {
      sAMAccountName: "JIAHUA.WU",
      manager: "LEO.ZOU",
    });

    expect(searchByFilter).not.toHaveBeenCalled();
    expect(withoutManager).toEqual({ sAMAccountName: "JIAHUA.WU" });
    expect(plainManager).toEqual({
      sAMAccountName: "JIAHUA.WU",
      manager: "LEO.ZOU",
    });
  });

  it("returns the original entry when the manager lookup misses", async () => {
    const searchByFilter = vi.fn().mockResolvedValue(null);
    const entry = {
      sAMAccountName: "JIAHUA.WU",
      manager: "CN=MISSING.USER,OU=Users,DC=delta,DC=corp",
    };

    const enriched = await enrichEntryWithManagerAccount(searchByFilter, entry);

    expect(enriched).toEqual(entry);
  });
});

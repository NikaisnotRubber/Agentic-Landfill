import { describe, expect, it } from "vitest";

import { inferRoleFromVmHostname } from "../../platform/mapping/inferRoleFromHostname";

describe("inferRoleFromVmHostname", () => {
  it("extracts the two-letter role code before trailing digits", () => {
    expect(inferRoleFromVmHostname("TWPJRDPSCNLT05")).toBe("LT");
    expect(inferRoleFromVmHostname("TWTAORDEVFSSW01")).toBe("SW");
  });

  it("returns an empty role for hostnames without a trailing role code", () => {
    expect(inferRoleFromVmHostname("TWPJOTHER")).toBe("");
    expect(inferRoleFromVmHostname("")).toBe("");
  });
});

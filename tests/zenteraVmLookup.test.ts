import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import { parseDdpTicket } from "../server/ddp/parseDdpTicket";
import { buildZenteraIndexesFromCsv } from "../server/zentera/buildZenteraIndexes";
import { resolveVmHostnameFromManager } from "../server/zentera/resolveVmHostnameFromManager";

const FIXTURE_DIR = path.resolve(import.meta.dirname, "fixtures");

function loadFixtureIndexes() {
  return buildZenteraIndexesFromCsv({
    userRolesCsv: readFileSync(path.join(FIXTURE_DIR, "zentera-user-roles.csv"), "utf8"),
    serverProfilesCsv: readFileSync(
      path.join(FIXTURE_DIR, "zentera-server-profiles.csv"),
      "utf8",
    ),
  });
}

describe("resolveVmHostnameFromManager", () => {
  it("maps manager account to hostnames via role and server profile join", () => {
    const indexes = loadFixtureIndexes();
    const result = resolveVmHostnameFromManager("LEO.ZOU", indexes);

    expect(result.source).toBe("zentera");
    expect(result.candidateHostnames).toEqual(["TWPJOTHER", "TWPJVM01", "TWPJVM02"]);
    expect(result.vmHostname).toBe("TWPJOTHER");
    expect(result.hadMultipleCandidates).toBe(true);
  });

  it("returns empty when the manager has no Zentera roles", () => {
    const indexes = loadFixtureIndexes();
    const result = resolveVmHostnameFromManager("UNKNOWN.USER", indexes);

    expect(result.vmHostname).toBe("");
    expect(result.source).toBe("");
  });
});

describe("parseDdpTicket Zentera VM fallback", () => {
  it("uses description VM when present, otherwise manager-based Zentera lookup", () => {
    const zentera = loadFixtureIndexes();

    const fromDescription = parseDdpTicket(
      {
        id: "1",
        status: "Open",
        subject: "DDP",
        requester: "LEO.ZOU 鄒皓年",
        technician: "",
        created_time: "",
        site: "",
        category: "",
        group: "",
        short_description: "遠端機器：TWPJFROMDESC",
        ad: {
          status: "enriched",
          adAccount: "LEO.ZOU",
          displayName: "鄒皓年",
          mail: "",
          department: "",
          manager: "鄒皓年",
          managerAccount: "LEO.ZOU",
          employeeId: "",
          bg: "",
          bu: "",
        },
      },
      false,
      { zentera },
    );

    expect(fromDescription.vmHostname).toBe("TWPJFROMDESC");
    expect(fromDescription.abnormalFlags).not.toContain("ambiguous-vm-hostname");

    const fromZentera = parseDdpTicket(
      {
        id: "2",
        status: "Open",
        subject: "DDP",
        requester: "NEW.USER 新員工",
        technician: "",
        created_time: "",
        site: "",
        category: "",
        group: "",
        short_description: "",
        ad: {
          status: "enriched",
          adAccount: "NEW.USER",
          displayName: "新員工",
          mail: "",
          department: "",
          manager: "鄒皓年",
          managerAccount: "LEO.ZOU",
          employeeId: "",
          bg: "",
          bu: "",
        },
      },
      false,
      { zentera },
    );

    expect(fromZentera.vmHostname).toBe("TWPJOTHER");
    expect(fromZentera.abnormalFlags).toContain("ambiguous-vm-hostname");
    expect(fromZentera.abnormalFlags).not.toContain("missing-vm-hostname");
  });
});

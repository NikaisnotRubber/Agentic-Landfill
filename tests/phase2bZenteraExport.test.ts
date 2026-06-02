import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { parseDdpTicket } from "../server/ddp/parseDdpTicket";
import { buildDdpExcelRowRecord } from "../server/excel/buildDdpExcelRows";
import { DDP_EXCEL_COLUMNS } from "../server/excel/ddpExcelColumns";
import { buildZenteraIndexesFromCsv } from "../server/zentera/buildZenteraIndexes";
import { deriveRoleCodeFromVmHostname } from "../server/zentera/deriveRoleFromVmHostname";
import { resolveZenteraExportFields } from "../server/zentera/resolveZenteraExportFields";

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

describe("deriveRoleCodeFromVmHostname", () => {
  it("extracts two-letter code before trailing digits", () => {
    expect(deriveRoleCodeFromVmHostname("TWPJRDPSCNLT05")).toBe("LT");
    expect(deriveRoleCodeFromVmHostname("TWTAORDEVFSSW01")).toBe("SW");
  });
});

describe("resolveZenteraExportFields", () => {
  it("maps VM hostname to Zentera role and app profile", () => {
    const indexes = loadFixtureIndexes();
    const fields = resolveZenteraExportFields({
      vmHostname: "TWPJVM01",
      managerAccount: "LEO.ZOU",
      applicantAccount: "NEW.USER",
      zentera: indexes,
    });

    expect(fields.role).toBe("MGR_ROLE_A");
    expect(fields.application).toBe("Digital Design Platform");
    expect(fields.userRoles).toBe("MGR_ROLE_A, SHARED_ROLE");
  });
});

describe("parseDdpTicket Zentera export columns", () => {
  it("fills role, application, and user roles on processed rows", () => {
    const zentera = loadFixtureIndexes();
    const row = parseDdpTicket(
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

    expect(row.vmHostname).toBe("TWPJOTHER");
    expect(row.role).toBe("SHARED_ROLE");
    expect(row.application).toBe("Digital Design Platform");
    expect(row.userRoles).toBe("MGR_ROLE_A, SHARED_ROLE");
  });

  it("derives role code from description VM when not in Server_Profiles", () => {
    const row = parseDdpTicket(
      {
        id: "3",
        status: "Open",
        subject: "DDP",
        requester: "LEO.ZOU 鄒皓年",
        technician: "",
        created_time: "",
        site: "",
        category: "",
        group: "",
        short_description: "遠端機器：TWPJFROMDESC99",
        ad: {
          status: "enriched",
          adAccount: "LEO.ZOU",
          displayName: "鄒皓年",
          mail: "",
          department: "",
          manager: "",
          managerAccount: "",
          employeeId: "",
          bg: "",
          bu: "",
        },
      },
      false,
      { zentera: loadFixtureIndexes() },
    );

    expect(row.vmHostname).toBe("TWPJFROMDESC99");
    expect(row.role).toBe("SC");
  });
});

describe("Excel export golden snapshot", () => {
  it("matches expected column values for a Zentera-backed row", () => {
    const zentera = loadFixtureIndexes();
    const ticket = {
      id: "golden-1",
      status: "Open",
      subject: "[DDP] golden",
      requester: "NEW.USER 新員工",
      technician: "",
      created_time: "",
      site: "",
      category: "",
      group: "",
      short_description: "",
      ad: {
        status: "enriched" as const,
        adAccount: "NEW.USER",
        displayName: "新員工",
        mail: "",
        department: "",
        manager: "",
        managerAccount: "LEO.ZOU",
        employeeId: "",
        bg: "",
        bu: "IT",
      },
    };

    const processed = parseDdpTicket(ticket, false, { zentera });
    const excel = buildDdpExcelRowRecord(ticket, processed);

    const columnMap = Object.fromEntries(
      DDP_EXCEL_COLUMNS.map((name, index) => [name, excel.values[index]]),
    );

    expect(columnMap["Role"]).toBe("SHARED_ROLE");
    expect(columnMap["Application"]).toBe("Digital Design Platform");
    expect(columnMap["User Roles"]).toBe("MGR_ROLE_A, SHARED_ROLE");
    expect(columnMap["VM HostName"]).toBe("TWPJOTHER");
    expect(columnMap["BU"]).toBe("IT");
  });
});

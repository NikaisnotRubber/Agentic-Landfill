import { describe, expect, it } from "vitest";

import { extractHostnamesFromDescription } from "../server/ddp/extractHostnamesFromDescription";
import { parseDdpTicket } from "../server/ddp/parseDdpTicket";
import sample from "./fixtures/helpdesk-sample-tickets.json" with { type: "json" };

describe("extractHostnamesFromDescription", () => {
  it("parses NB and VM hostnames from standard DDP description labels", () => {
    const hostnames = extractHostnamesFromDescription(
      "姓名 (Account name): SALT.LIAO 廖家賢工號 (ID): 948331電腦編號 (NB): TWCL1NB5166主管或同仁的連線主機(Connect VM): TWTAORDEVFSSW01",
    );

    expect(hostnames.nbHostname).toBe("TWCL1NB5166");
    expect(hostnames.vmHostname).toBe("TWTAORDEVFSSW01");
    expect(hostnames.hadInvalidVm).toBe(false);
  });

  it("flags invalid VM placeholders without keeping the hostname value", () => {
    const hostnames = extractHostnamesFromDescription("連線 DDP 主機名稱: localhost");

    expect(hostnames.vmHostname).toBe("");
    expect(hostnames.hadInvalidVm).toBe(true);
  });
});

describe("parseDdpTicket", () => {
  it("uses enriched ticket.ad for identity and description for hostnames", () => {
    const row = parseDdpTicket(
      {
        id: "822184",
        status: "Open",
        subject: "[DDP] New Member-AD account name",
        requester: "LEO.ZOU 鄒皓年",
        technician: "ADAM.HSU 許竹棪",
        created_time: "29/05/2026 04:03 PM",
        site: "中壢五廠/Chungli Factory V",
        category: "",
        group: "IT-DDP",
        short_description:
          "姓名 (Account name )：LEO.ZOU 鄒皓年 電腦編號 (NB)：TWCL1NB5308 遠端機器：TWPJRDPSCNLT05",
        ad: {
          status: "enriched",
          adAccount: "LEO.ZOU",
          displayName: "鄒皓年",
          mail: "leo.zou@deltaww.com",
          department: "",
          manager: "主管名",
          employeeId: "",
          bg: "LTW",
          bu: "IT",
        },
      },
      false,
    );

    expect(row.adAccount).toBe("LEO.ZOU");
    expect(row.adName).toBe("鄒皓年");
    expect(row.firstName).toBe("LEO");
    expect(row.lastName).toBe("ZOU");
    expect(row.mail).toBe("leo.zou@deltaww.com");
    expect(row.bu).toBe("IT");
    expect(row.nbHostname).toBe("TWCL1NB5308");
    expect(row.vmHostname).toBe("TWPJRDPSCNLT05");
    expect(row.abnormalFlags).not.toContain("missing-ad-account");
  });

  it("marks missing AD account when description and requester do not yield an applicant", () => {
    const row = parseDdpTicket({
      id: "1",
      status: "Open",
      subject: "DDP sample",
      requester: "SARA.YS.TSAI 蔡易珊",
      technician: "",
      created_time: "",
      site: "",
      category: "",
      group: "",
      short_description: "連線 DDP 主機名稱: localhost",
    });

    expect(row.adAccount).toBe("");
    expect(row.vmHostname).toBe("");
    expect(row.abnormalFlags).toContain("missing-ad-account");
    expect(row.abnormalFlags).toContain("missing-nb-hostname");
    expect(row.abnormalFlags).toContain("invalid-vm-hostname");
  });

  it("parses hostnames and applicant AD from description without LDAP enrichment", () => {
    const ticket = sample[0]!;
    const row = parseDdpTicket(ticket);

    expect(row.nbHostname).toBe("TWCL1NB5166");
    expect(row.vmHostname).toBe("TWTAORDEVFSSW01");
    expect(row.adAccount).toBe("SALT.LIAO");
    expect(row.adName).toBe("廖家賢");
    expect(row.mail).toBe("SALT.LIAO@deltaww.com");
    expect(row.abnormalFlags).not.toContain("missing-ad-account");
  });
});

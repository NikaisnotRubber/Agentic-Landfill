import { describe, expect, it } from "vitest";

import { parseDdpTicket } from "../server/ddp/parseDdpTicket";

describe("parseDdpTicket", () => {
  it("prefers requester account when it matches the description", () => {
    const row = parseDdpTicket({
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
    });

    expect(row.adAccount).toBe("LEO.ZOU");
    expect(row.adName).toBe("鄒皓年");
    expect(row.nbHostname).toBe("TWCL1NB5308");
    expect(row.vmHostname).toBe("TWPJRDPSCNLT05");
  });

  it("marks missing account and invalid vm placeholders as abnormal", () => {
    const row = parseDdpTicket({
      id: "1",
      status: "Open",
      subject: "DDP sample",
      requester: "",
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
});

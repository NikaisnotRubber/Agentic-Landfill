import { describe, expect, it } from "vitest";

import {
  abnormalFlagsToExcelIssues,
  buildAbnormalFlags,
} from "../server/ddp/abnormalFlags";
import { extractAdAccountFromDescription } from "../server/ddp/extractIdentityFromDescription";
import { parseDdpTicket } from "../server/ddp/parseDdpTicket";
import { resolveIdentityFromDescriptionAndRequester } from "../server/ddp/resolveIdentityFromDescriptionAndRequester";
import { buildDdpExcelRowRecord } from "../server/excel/buildDdpExcelRows";
import sample from "./fixtures/helpdesk-sample-tickets.json" with { type: "json" };

describe("resolveIdentityFromDescriptionAndRequester", () => {
  it("uses applicant from description when requester is the submitter", () => {
    const ticket = sample[0]!;
    const identity = resolveIdentityFromDescriptionAndRequester(
      ticket.short_description,
      ticket.requester,
    );

    expect(identity.adAccount).toBe("SALT.LIAO");
    expect(identity.adName).toBe("廖家賢");
  });

  it("prefers requester AD when requester matches description", () => {
    const identity = resolveIdentityFromDescriptionAndRequester(
      "使用者帳號：LEO.ZOU",
      "LEO.ZOU 鄒皓年",
    );

    expect(identity.adAccount).toBe("LEO.ZOU");
    expect(identity.adName).toBe("鄒皓年");
  });
});

describe("extractAdAccountFromDescription", () => {
  it("reads Account name label from normalized DDP text", () => {
    const account = extractAdAccountFromDescription(
      "姓名 (Account name ): SALT.LIAO 廖家賢 電腦編號 (NB)：TWCL1NB5166",
    );
    expect(account).toBe("SALT.LIAO");
  });
});

describe("abnormalFlags alignment (D1)", () => {
  it("includes Zentera missing VM in Excel issues", () => {
    const flags = buildAbnormalFlags({
      adAccount: "LEO.ZOU",
      nbHostname: "TWCL1NB1234",
      vmHostname: "",
      hadInvalidVm: false,
      hadMultipleZenteraVmCandidates: false,
    });

    expect(flags).toContain("missing-vm-hostname");
    expect(abnormalFlagsToExcelIssues(flags, "")).toContain("VM HostName");
  });

  it("includes ambiguous VM in Excel issues", () => {
    const flags = buildAbnormalFlags({
      adAccount: "LEO.ZOU",
      nbHostname: "TWCL1NB1234",
      vmHostname: "TWPJVM01",
      hadInvalidVm: false,
      hadMultipleZenteraVmCandidates: true,
    });

    expect(abnormalFlagsToExcelIssues(flags, "")).toContain("VM HostName(多筆候選)");
  });

  it("matches Processed flags to Excel row abnormal state", () => {
    const row = parseDdpTicket({
      id: "9",
      status: "Open",
      subject: "DDP",
      requester: "LEO.ZOU 鄒皓年",
      technician: "",
      created_time: "",
      site: "",
      category: "",
      group: "",
      short_description: "電腦編號(NB): TWCL1NB1234",
    });

    const excel = buildDdpExcelRowRecord(
      {
        id: "9",
        status: "Open",
        subject: "DDP",
        requester: "LEO.ZOU 鄒皓年",
        technician: "",
        created_time: "",
        site: "",
        category: "",
        group: "",
        short_description: "電腦編號(NB): TWCL1NB1234",
      },
      row,
    );

    expect(row.abnormalFlags).toContain("missing-ad-account");
    expect(row.abnormalFlags).toContain("missing-vm-hostname");
    expect(excel.abnormalFlag).toBe("檢查");
  });
});

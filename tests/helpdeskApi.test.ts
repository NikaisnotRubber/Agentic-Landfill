import { describe, expect, it } from "vitest";

import {
  TARGET_FIELDS,
  buildHelpdeskApiUrl,
  cleanTicketRecords,
  isHelpdeskAuthFailure,
} from "../server/helpdeskApi";

describe("buildHelpdeskApiUrl", () => {
  it("rebuilds the helpdesk request URL with the requested count and fields", () => {
    const url = buildHelpdeskApiUrl({
      count: 12,
      filterId: "2130",
      fields: TARGET_FIELDS,
    });

    const parsed = new URL(url);
    const inputData = JSON.parse(parsed.searchParams.get("input_data") ?? "{}");

    expect(`${parsed.origin}${parsed.pathname}`).toBe(
      "https://ithelpdesk.deltaww.com/api/v3/requests",
    );
    expect(parsed.searchParams.get("SUBREQUEST")).toBe("XMLHTTP");
    expect(inputData.list_info.row_count).toBe(12);
    expect(inputData.list_info.sort_field).toBe("created_time");
    expect(inputData.list_info.sort_order).toBe("desc");
    expect(inputData.list_info.fields_required).toEqual(TARGET_FIELDS);
    expect(inputData.list_info.filter_by.id).toBe("2130");
  });
});

describe("isHelpdeskAuthFailure", () => {
  it("detects auth-token failures from the Helpdesk API payload", () => {
    const authFailure = {
      response_status: {
        status_code: 4000,
        status: "failed",
        messages: [
          {
            status_code: 401,
            type: "failed",
            message: "AuthToken in the request is invalid. Unable to authenticate.",
          },
        ],
      },
    };

    expect(isHelpdeskAuthFailure(authFailure)).toBe(true);
  });

  it("does not mark successful payloads as auth failures", () => {
    const success = {
      response_status: [{ status_code: 2000, status: "success" }],
      requests: [],
    };

    expect(isHelpdeskAuthFailure(success)).toBe(false);
  });
});

describe("cleanTicketRecords", () => {
  it("normalizes nested helpdesk objects into display-friendly ticket records", () => {
    const cleaned = cleanTicketRecords([
      {
        id: "817742",
        subject: "Software install",
        requester: { name: "JOE.KUAN 管紹宇" },
        technician: { name: "ALVIS.MC.TSAO 曹閔丞" },
        status: { name: "Closed", color: "#006600" },
        group: { name: "IT Helpdesk" },
        category: { name: "Software" },
        site: { name: "Taipei Office" },
        created_time: { display_value: "22/05/2026 08:00 AM" },
        short_description: "Example description",
      },
    ]);

    expect(cleaned).toEqual([
      {
        id: "817742",
        subject: "Software install",
        requester: "JOE.KUAN 管紹宇",
        technician: "ALVIS.MC.TSAO 曹閔丞",
        status: "Closed",
        group: "IT Helpdesk",
        category: "Software",
        site: "Taipei Office",
        created_time: "22/05/2026 08:00 AM",
        short_description: "Example description",
      },
    ]);
  });
});

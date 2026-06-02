import { describe, expect, it } from "vitest";

import { parseFirstLastFromAdName } from "../server/ddp/parseAdName";

describe("parseFirstLastFromAdName", () => {
  it("parses First.Last then ignores trailing content after whitespace", () => {
    expect(parseFirstLastFromAdName("LEO.ZOU 鄒皓年")).toEqual({
      firstName: "LEO",
      lastName: "ZOU",
    });
    expect(parseFirstLastFromAdName("JIAHUA.WU 吳家驊")).toEqual({
      firstName: "JIAHUA",
      lastName: "WU",
    });
  });

  it("parses a dotted Latin prefix without trailing text", () => {
    expect(parseFirstLastFromAdName("LEO.ZOU")).toEqual({
      firstName: "LEO",
      lastName: "ZOU",
    });
  });

  it("uses the first and last segment when the Latin prefix has multiple dots", () => {
    expect(parseFirstLastFromAdName("SARA.YS.TSAI 蔡易珊")).toEqual({
      firstName: "SARA",
      lastName: "TSAI",
    });
  });

  it("returns empty parts when AD Name has no Latin First.Last prefix", () => {
    expect(parseFirstLastFromAdName("鄒皓年")).toEqual({
      firstName: "",
      lastName: "",
    });
    expect(parseFirstLastFromAdName("")).toEqual({
      firstName: "",
      lastName: "",
    });
  });
});

import { describe, expect, it } from "vitest";

import { repairMojibakeText } from "../server/ad/repairMojibakeText";

describe("repairMojibakeText", () => {
  it("decodes 鄒皓年 from misinterpreted UTF-8 bytes", () => {
    const original = "鄒皓年";
    const garbled = Buffer.from(original, "utf8").toString("latin1");
    expect(repairMojibakeText(garbled)).toBe(original);
  });
});

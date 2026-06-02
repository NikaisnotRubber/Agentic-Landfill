import { describe, expect, it } from "vitest";

import { repairSwappedUserNames } from "../../platform/import/repairUserNames";

describe("repairSwappedUserNames", () => {
  it("swaps when last name is a single character", () => {
    expect(repairSwappedUserNames("小明", "鄒")).toEqual({
      firstName: "鄒",
      lastName: "小明",
    });
  });

  it("leaves normal names unchanged when last name is not a single character", () => {
    expect(repairSwappedUserNames("家驊", "吳家")).toEqual({
      firstName: "家驊",
      lastName: "吳家",
    });
  });
});

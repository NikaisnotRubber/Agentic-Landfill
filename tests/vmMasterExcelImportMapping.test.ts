import { describe, expect, it } from "vitest";

import type { VmMasterExcelImportMapping } from "../src/features/vm-master/types";
import {
  getDisabledImportFields,
  updateImportMapping,
} from "../src/features/vm-master/excelImportMapping";

describe("VM Master Excel import mapping helpers", () => {
  it("disables fields selected by other headers", () => {
    const mapping = {
      "AD Name": "AD_NAME",
      VM: "VM_NAME",
    } satisfies VmMasterExcelImportMapping;

    expect(getDisabledImportFields(mapping, "AD Name")).toEqual(new Set(["VM_NAME"]));
    expect(getDisabledImportFields(mapping, "VM")).toEqual(new Set(["AD_NAME"]));
  });

  it("updates mapping without keeping blank selections", () => {
    expect(updateImportMapping({ A: "AD_NAME" }, "A", "")).toEqual({});
    expect(updateImportMapping({ A: "AD_NAME" }, "B", "VM_NAME")).toEqual({
      A: "AD_NAME",
      B: "VM_NAME",
    });
  });
});
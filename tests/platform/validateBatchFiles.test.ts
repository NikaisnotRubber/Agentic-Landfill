import { describe, expect, it } from "vitest";

import { validateBatchFiles } from "../../platform/import/validateBatchFiles";

describe("validateBatchFiles", () => {
  it("accepts platform-batch fixture files", async () => {
    const result = await validateBatchFiles({
      adGroupsXlsx: "tests/fixtures/platform-batch/groups_LTW_all.xlsx",
      userRolesCsv: "tests/fixtures/platform-batch/User_Roles.csv",
      usersCsv: "tests/fixtures/platform-batch/Users.csv",
      serverProfilesCsv: "tests/fixtures/platform-batch/Server_Profiles.csv",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects missing files", async () => {
    const result = await validateBatchFiles({
      adGroupsXlsx: "missing.xlsx",
      userRolesCsv: "tests/fixtures/platform-batch/User_Roles.csv",
      usersCsv: "tests/fixtures/platform-batch/Users.csv",
      serverProfilesCsv: "tests/fixtures/platform-batch/Server_Profiles.csv",
    });
    expect(result.ok).toBe(false);
  });
});

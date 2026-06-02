import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { loadMappingExportSchema } from "../../platform/contract/loadMappingExportSchema";
import { serializeMappingRowRecord } from "../../platform/export/serializeMappingRow";
import type { MappingRow } from "../../platform/export/types";

describe("mapping export golden row", () => {
  it("matches fixture excel header cells", async () => {
    const golden = JSON.parse(
      await readFile("tests/fixtures/mapping-export-golden-row.json", "utf8"),
    ) as { excelHeaders: Record<string, string> };

    const row: MappingRow = {
      ad_account: "LEO.ZOU",
      ad_name: "鄒小明",
      first_name: "鄒",
      last_name: "小明",
      mail: "leo.zou@deltaww.com",
      bg: "ITBG",
      bu: "IT",
      role_export: "",
      role_inferred: "",
      role_override: "",
      nb_hostname: "",
      group_owner: "G-Delta-rollout_admin",
      group_name: "L-TW-EXAMPLE",
      nas_folder_name: "",
      vm_hostname: "TWPJOTHER",
      host_ip: "10.1.2.3",
      new_vm: "",
      user_roles: "MGR_ROLE_A",
      application: "Digital Design Platform",
      template_name: "",
      location: "",
    };

    const schema = await loadMappingExportSchema();
    const serialized = serializeMappingRowRecord(row, schema);
    expect(serialized).toEqual(golden.excelHeaders);
  });
});

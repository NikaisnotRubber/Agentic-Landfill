import { describe, expect, it } from "vitest";

import { loadMappingExportSchema } from "../../platform/contract/loadMappingExportSchema";
import {
  resolveRoleExportValue,
  serializeMappingRow,
} from "../../platform/export/serializeMappingRow";
import type { MappingRow } from "../../platform/export/types";

function sampleRow(overrides: Partial<MappingRow> = {}): MappingRow {
  return {
    ad_account: "leo.zou",
    ad_name: "鄒某某",
    first_name: "某某",
    last_name: "鄒",
    mail: "LEO.ZOU@deltaww.com",
    bg: "ITBG",
    bu: "IT",
    role_export: "",
    role_inferred: "CE",
    role_override: "",
    nb_hostname: "",
    group_owner: "G-Delta-rollout_admin",
    group_name: "L-TW-EXAMPLE",
    nas_folder_name: "",
    vm_hostname: "TWPJ1RDAECE01",
    host_ip: "10.0.0.1",
    new_vm: "",
    user_roles: "SHARED_ROLE",
    application: "Digital Design Platform",
    template_name: "",
    location: "",
    ...overrides,
  };
}

describe("serializeMappingRow", () => {
  it("uppercases AD Account and VM HostName per contract", async () => {
    const schema = await loadMappingExportSchema();
    const values = serializeMappingRow(
      sampleRow({ ad_account: "leo.zou", vm_hostname: "twpjother" }),
      schema,
    );
    const headers = schema.columns.map((column) => column.excelHeader);
    expect(values[headers.indexOf("AD Account")]).toBe("LEO.ZOU");
    expect(values[headers.indexOf("VM HostName")]).toBe("TWPJOTHER");
  });

  it("uses role_override over role_inferred for Role column", async () => {
    const row = sampleRow({ role_override: "XX", role_inferred: "CE", role_export: "CE" });
    expect(resolveRoleExportValue(row)).toBe("XX");
    const schema = await loadMappingExportSchema();
    const headers = schema.columns.map((column) => column.excelHeader);
    const values = serializeMappingRow(row, schema);
    expect(values[headers.indexOf("Role")]).toBe("XX");
  });

  it("returns 19 export cells in schema order", async () => {
    const schema = await loadMappingExportSchema();
    expect(serializeMappingRow(sampleRow(), schema)).toHaveLength(19);
  });
});

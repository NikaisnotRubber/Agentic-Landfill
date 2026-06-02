/** DB row for `mapping_row` — keys align with mapping-export-schema.json `dbColumn`. */
export type MappingRow = {
  id?: string;
  batch_id?: string;
  ad_account: string;
  ad_name: string;
  first_name: string;
  last_name: string;
  mail: string;
  bg: string;
  bu: string;
  role_export: string;
  role_inferred: string;
  role_override: string;
  nb_hostname: string;
  group_owner: string;
  group_name: string;
  nas_folder_name: string;
  vm_hostname: string;
  host_ip: string;
  new_vm: string;
  user_roles: string;
  application: string;
  template_name: string;
  location: string;
  source_ad_member_row_id?: string;
  created_at?: string;
};

export function emptyMappingRow(): MappingRow {
  return {
    ad_account: "",
    ad_name: "",
    first_name: "",
    last_name: "",
    mail: "",
    bg: "",
    bu: "",
    role_export: "",
    role_inferred: "",
    role_override: "",
    nb_hostname: "",
    group_owner: "G-Delta-rollout_admin",
    group_name: "",
    nas_folder_name: "",
    vm_hostname: "",
    host_ip: "",
    new_vm: "",
    user_roles: "",
    application: "",
    template_name: "",
    location: "",
  };
}

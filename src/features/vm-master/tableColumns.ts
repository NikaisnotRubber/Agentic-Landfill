import type { ColumnDef } from "@tanstack/vue-table";
import type { VmMasterPreviewRow } from "./types";

export function getVmMasterSearchText(row: VmMasterPreviewRow): string {
  return [
    row.bg,
    row.adName,
    row.chnName,
    row.emailAddress,
    row.vmName,
    row.bu,
    row.userRole,
    row.groupName,
    row.zenteraRole,
    String(row.maxOnlineUsers ?? ""),
    row.userDept,
    row.reportTo,
  ].join(" ");
}

export const vmMasterColumns: ColumnDef<VmMasterPreviewRow>[] = [
  {
    id: "bg",
    accessorKey: "bg",
    header: "BG",
    enableGrouping: true,
  },
  {
    id: "adName",
    accessorKey: "adName",
    header: "AD_NAME",
  },
  {
    id: "chnName",
    accessorKey: "chnName",
    header: "CHN_NAME",
  },
  {
    id: "emailAddress",
    accessorKey: "emailAddress",
    header: "EMAIL_ADDRESS",
  },
  {
    id: "vmName",
    accessorKey: "vmName",
    header: "VM_NAME",
  },
  {
    id: "maxOnlineUsers",
    accessorKey: "maxOnlineUsers",
    header: "MAX_ONLINE_USERS",
  },
  {
    id: "bu",
    accessorKey: "bu",
    header: "BU",
  },
  {
    id: "userRole",
    accessorKey: "userRole",
    header: "USER_ROLE",
  },
  {
    id: "groupName",
    accessorKey: "groupName",
    header: "GROUP_NAME",
  },
  {
    id: "zenteraRole",
    accessorKey: "zenteraRole",
    header: "ZENTERA_ROLE",
  },
  {
    id: "userDept",
    accessorKey: "userDept",
    header: "USER_DEPT",
  },
  {
    id: "reportTo",
    accessorKey: "reportTo",
    header: "REPORT_TO",
  },
];

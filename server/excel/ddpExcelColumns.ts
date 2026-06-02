/** Column order aligned with `IT工單(不可用，僅供參考)/process_ddp_tickets.py` COLUMNS. */
export const DDP_EXCEL_COLUMNS = [
  "Ticket ID",
  "異常",
  "工單狀態",
  "AD Account",
  "AD Name (Chinese Name)",
  "FirstName",
  "LastName",
  "Mail",
  "BU",
  "Role",
  "NB Hostname",
  "Group Owner",
  "Group Name",
  "NAS Folder Name",
  "VM HostName",
  "NEW VM",
  "User Roles",
  "Application",
  "Template Name",
  "Location",
] as const;

export const DDP_EXCEL_GROUP_OWNER = "G-Delta-rollout_admin";

export const DDP_EXCEL_SHEET_PENDING = "待處理";
export const DDP_EXCEL_SHEET_CLOSED = "Closed";
export const DDP_EXCEL_SHEET_ALL = "All";

export const DDP_HELPDESK_TICKET_URL =
  "https://ithelpdesk.deltaww.com/WorkOrder.do?woMode=viewWO&woID=";

export const DDP_EXCEL_STATUS_COLUMN_INDEX = DDP_EXCEL_COLUMNS.indexOf("工單狀態") + 1;

export const DDP_EXCEL_HEADER_FILL_PRIMARY = "FFEBF4F4";
export const DDP_EXCEL_HEADER_FILL_ALT = "FFDCE6F1";
export const DDP_EXCEL_ABNORMAL_FILL = "FFFFC7CE";
export const DDP_EXCEL_PENDING_FILL = "FFFFFF00";

export const DDP_EXCEL_DEFAULT_FILENAME = "ddp_ticket_maintain.xlsx";

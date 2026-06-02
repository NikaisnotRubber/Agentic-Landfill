import { abnormalFlagsToExcelIssues, hasExcelAbnormal } from "../ddp/abnormalFlags";

import { findInvalidVmValueInDescription } from "../ddp/extractHostnamesFromDescription";

import type { ProcessedDdpRow } from "../ddp/types";

import type { TicketRecord } from "../types";

import {

  DDP_EXCEL_COLUMNS,

  DDP_EXCEL_GROUP_OWNER,

  DDP_HELPDESK_TICKET_URL,

} from "./ddpExcelColumns";



export type DdpExcelRowRecord = {

  values: (string | number)[];

  ticketId: string;

  ticketUrl: string;

  abnormalFlag: string;

  abnormalSubject: string;

  abnormalHyperlink: string;

  status: string;

  isPending: boolean;

};



/** @deprecated Use abnormalFlagsToExcelIssues with processed row flags. */

export function buildDdpExcelAbnormalIssues(options: {

  adAccount: string;

  nbHostname: string;

  invalidVmValue: string;

}): string[] {

  const flags: string[] = [];

  if (!options.adAccount) {

    flags.push("missing-ad-account");

  }

  if (!options.nbHostname) {

    flags.push("missing-nb-hostname");

  }

  if (options.invalidVmValue) {

    flags.push("invalid-vm-hostname");

  }

  return abnormalFlagsToExcelIssues(flags, options.invalidVmValue);

}



export function buildHelpdeskTicketUrl(ticketId: string): string {

  return ticketId ? `${DDP_HELPDESK_TICKET_URL}${ticketId}` : "";

}



export function resolveExportMail(adAccount: string, mail: string): string {

  if (mail) {

    return mail;

  }

  return adAccount ? `${adAccount}@deltaww.com` : "";

}



export function buildDdpExcelRowRecord(

  ticket: TicketRecord,

  processed?: ProcessedDdpRow,

): DdpExcelRowRecord {

  const adAccount = processed?.adAccount ?? "";

  const nbHostname = processed?.nbHostname ?? "";

  const invalidVmValue = findInvalidVmValueInDescription(ticket.short_description ?? "");

  const vmHostname = processed?.vmHostname ?? "";

  const mail = resolveExportMail(adAccount, processed?.mail ?? "");

  const issues = abnormalFlagsToExcelIssues(processed?.abnormalFlags ?? [], invalidVmValue);

  const ticketId = ticket.id;

  const ticketUrl = buildHelpdeskTicketUrl(ticketId);

  const hasAbnormal = hasExcelAbnormal(issues);

  const status = ticket.status;

  const abnormalSubject = ticket.subject || processed?.subject || "檢查";



  return {

    ticketId,

    ticketUrl,

    abnormalFlag: hasAbnormal ? "檢查" : "",

    abnormalSubject,

    abnormalHyperlink: hasAbnormal && ticketId ? ticketUrl : "",

    status,

    isPending: status === "Open" || status === "Onhold",

    values: [

      ticketId,

      hasAbnormal ? "檢查" : "",

      status,

      adAccount,

      processed?.adName ?? "",

      processed?.firstName ?? "",

      processed?.lastName ?? "",

      mail,

      processed?.bu ?? "",

      processed?.role ?? "",

      nbHostname,

      DDP_EXCEL_GROUP_OWNER,

      "",

      "",

      vmHostname,

      "",

      processed?.userRoles ?? "",

      processed?.application ?? "",

      "",

      "",

    ],

  };

}



export function buildDdpExcelRowRecords(

  tickets: TicketRecord[],

  processedRows: ProcessedDdpRow[] = [],

): DdpExcelRowRecord[] {

  const processedById = new Map(processedRows.map((row) => [row.ticketId, row]));

  return tickets.map((ticket) => buildDdpExcelRowRecord(ticket, processedById.get(ticket.id)));

}



export function assertDdpExcelRowShape(row: DdpExcelRowRecord): void {

  if (row.values.length !== DDP_EXCEL_COLUMNS.length) {

    throw new Error(

      `Excel row has ${row.values.length} columns, expected ${DDP_EXCEL_COLUMNS.length}`,

    );

  }

}



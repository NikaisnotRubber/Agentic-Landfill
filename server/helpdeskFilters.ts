import type { TicketRecord } from "./types";

export function isDdpSubject(subject: string): boolean {
  return subject.includes("DDP");
}

export function filterTicketsForDdp(tickets: TicketRecord[]): TicketRecord[] {
  return tickets.filter((ticket) => isDdpSubject(ticket.subject));
}

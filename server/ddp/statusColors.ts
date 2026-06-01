export type TicketStatusTone = "open" | "closed" | "resolved" | "neutral";

export function getTicketStatusTone(status: string): TicketStatusTone {
  const normalized = status.trim().toLowerCase();
  if (normalized === "open") {
    return "open";
  }
  if (normalized === "closed") {
    return "closed";
  }
  if (normalized === "resolved") {
    return "resolved";
  }
  return "neutral";
}

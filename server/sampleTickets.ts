import { readFile } from "node:fs/promises";
import path from "node:path";

import { cleanTicketRecords } from "./helpdeskApi";
import type { TicketFetchSuccess } from "./types";

const SAMPLE_PATH = path.resolve(
  process.cwd(),
  "IT工單(不可用，僅供參考)",
  "delta_tickets_clean.json",
);

export async function readSampleTickets(): Promise<TicketFetchSuccess> {
  const rawText = await readFile(SAMPLE_PATH, "utf8");
  const parsed = JSON.parse(rawText) as unknown[];
  const tickets = cleanTicketRecords(parsed);

  return {
    ok: true,
    source: "sample",
    count: tickets.length,
    tickets,
    raw: parsed,
  };
}

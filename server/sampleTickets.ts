import { readFile } from "node:fs/promises";
import path from "node:path";

import { cleanTicketRecords } from "./helpdeskApi";
import type { TicketFetchSuccess } from "./types";

const SAMPLE_PATH = path.resolve(
  process.cwd(),
  "tests",
  "fixtures",
  "helpdesk-sample-tickets.json",
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

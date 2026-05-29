import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { cleanTicketRecords } from "./helpdeskApi";
import { filterTicketsForDdp } from "./helpdeskFilters";
import type { TicketFetchSuccess } from "./types";

const SAMPLE_DIR = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_PATH = path.resolve(
  SAMPLE_DIR,
  "..",
  "tests",
  "fixtures",
  "helpdesk-sample-tickets.json",
);

export async function readSampleTickets(): Promise<TicketFetchSuccess> {
  const rawText = await readFile(SAMPLE_PATH, "utf8");
  const parsed = JSON.parse(rawText) as unknown[];
  const tickets = filterTicketsForDdp(cleanTicketRecords(parsed));

  return {
    ok: true,
    source: "sample",
    count: tickets.length,
    tickets,
    raw: parsed,
  };
}

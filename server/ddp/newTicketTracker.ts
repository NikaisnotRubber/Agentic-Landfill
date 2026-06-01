import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ProcessedDdpSummary } from "./types";

const DEFAULT_TRACKER_PATH = path.resolve(
  process.cwd(),
  "IT工單(不可用，僅供參考)",
  "last_seen_id.txt",
);

export type TrackerTicket = {
  id: string;
  subject: string;
};

export type TrackerDeps = {
  readTracker: () => Promise<string>;
  writeTracker: (nextId: string) => Promise<void>;
};

export type NewTicketDetectionResult = {
  newTicketIds: string[];
  summary: Pick<
    ProcessedDdpSummary,
    "latestSeenId" | "previousSeenId" | "newTicketCount" | "trackerWarning"
  >;
};

export function createDefaultTrackerDeps(trackerPath = DEFAULT_TRACKER_PATH): TrackerDeps {
  return {
    readTracker: async () => {
      try {
        return (await readFile(trackerPath, "utf8")).trim();
      } catch {
        return "";
      }
    },
    writeTracker: async (nextId: string) => {
      await writeFile(trackerPath, nextId, "utf8");
    },
  };
}

export async function detectNewTickets(
  tickets: TrackerTicket[],
  deps: TrackerDeps,
): Promise<NewTicketDetectionResult> {
  const emptySummary = {
    latestSeenId: undefined,
    previousSeenId: undefined,
    newTicketCount: 0,
    trackerWarning: undefined,
  } satisfies NewTicketDetectionResult["summary"];

  if (tickets.length === 0) {
    return { newTicketIds: [], summary: emptySummary };
  }

  const latestId = String(tickets[0].id);
  const previousSeenId = (await deps.readTracker()).trim();

  if (latestId === previousSeenId) {
    return {
      newTicketIds: [],
      summary: {
        latestSeenId: latestId,
        previousSeenId: previousSeenId || undefined,
        newTicketCount: 0,
      },
    };
  }

  let newTicketIds: string[] = [];
  let trackerWarning: string | undefined;

  if (!previousSeenId) {
    newTicketIds = [latestId];
  } else {
    let foundPrevious = false;
    for (const ticket of tickets) {
      if (String(ticket.id) === previousSeenId) {
        foundPrevious = true;
        break;
      }
      newTicketIds.push(String(ticket.id));
    }

    if (!foundPrevious) {
      trackerWarning = `Previous ticket id ${previousSeenId} was not found in the current batch`;
      newTicketIds = [];
    }
  }

  await deps.writeTracker(latestId);

  return {
    newTicketIds,
    summary: {
      latestSeenId: latestId,
      previousSeenId: previousSeenId || undefined,
      newTicketCount: newTicketIds.length,
      trackerWarning,
    },
  };
}

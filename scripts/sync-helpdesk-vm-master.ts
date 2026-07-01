import { syncHelpdeskVmMaster } from "../server/vmMaster/helpdeskSync";
import type { HelpdeskVmSyncOptions } from "../server/vmMaster/types";

function readValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

export function parseHelpdeskVmSyncArgs(args: string[]): HelpdeskVmSyncOptions {
  const count = Number(readValue(args, "--count") ?? 25);
  if (!Number.isFinite(count) || count <= 0) {
    throw new Error("--count must be a positive number");
  }

  return {
    count,
    technician: readValue(args, "--technician"),
    filterId: readValue(args, "--filter-id"),
    stateFile: readValue(args, "--state-file"),
    ddpOnly: args.includes("--no-ddp-only") ? false : true,
  };
}

async function main(): Promise<void> {
  const result = await syncHelpdeskVmMaster(parseHelpdeskVmSyncArgs(process.argv.slice(2)));
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) {
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

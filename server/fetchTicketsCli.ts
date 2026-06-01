import { fetchProcessAndEnrich } from "./fetchProcessAndEnrich";

function parseArgs(argv: string[]) {
  const args = {
    count: 25,
    technician: "",
    filterId: "",
    stateFile: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    const next = argv[index + 1];

    if (value === "--count" && next) {
      args.count = Number(next);
      index += 1;
    } else if (value === "--technician" && next) {
      args.technician = next;
      index += 1;
    } else if (value === "--filter-id" && next) {
      args.filterId = next;
      index += 1;
    } else if (value === "--state-file" && next) {
      args.stateFile = next;
      index += 1;
    }
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await fetchProcessAndEnrich(
    {
      count: args.count,
      technician: args.technician || undefined,
      filterId: args.filterId || undefined,
      stateFile: args.stateFile || undefined,
    },
    { persistTracker: true, enrich: false },
  );

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) {
    process.exitCode = 1;
  }
}

void main();

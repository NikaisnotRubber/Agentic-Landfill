import path from "node:path";

import { fetchSharePointFile } from "./sharepoint/fetchSharePointFile";

const DEFAULT_CONFIG_PATH = path.resolve(process.cwd(), "config/sharepoint.yaml");

function parseArgs(argv: string[]) {
  let configPath = DEFAULT_CONFIG_PATH;
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    const next = argv[index + 1];
    if (value === "--config" && next) {
      configPath = path.resolve(process.cwd(), next);
      break;
    }
    if (value.startsWith("--config=")) {
      configPath = path.resolve(process.cwd(), value.slice("--config=".length));
      break;
    }
  }
  return { configPath };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await fetchSharePointFile({ configPath: args.configPath });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

import path from "node:path";

import { DEFAULT_HELPDESK_AUTH_CONFIG_PATH } from "./auth/defaultHelpdeskAuthConfigPath";
import { loginAndSaveState } from "./auth/loginAndSaveState";

function parseArgs(argv: string[]) {
  const args = {
    configPath: DEFAULT_HELPDESK_AUTH_CONFIG_PATH,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    const next = argv[index + 1];

    if (value === "--config" && next) {
      args.configPath = path.resolve(process.cwd(), next);
      index += 1;
    }
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await loginAndSaveState({
    configPath: args.configPath,
  });

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: result.ok,
        stateFile: result.stateFile,
        baseUrl: result.baseUrl,
      },
      null,
      2,
    )}\n`,
  );
}

void main();

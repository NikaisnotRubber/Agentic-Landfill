import { existsSync } from "node:fs";
import path from "node:path";

import { loginAndSaveState } from "../../server/auth/loginAndSaveState";

async function main() {
  const configPath = path.resolve(process.cwd(), "config", "helpdesk-auth.local.yaml");

  if (!existsSync(configPath)) {
    process.stderr.write(
      `Missing local login config: ${configPath}\nCreate it from config/helpdesk-auth.example.yaml before running this script.\n`,
    );
    process.exitCode = 1;
    return;
  }

  const result = await loginAndSaveState({ configPath });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

void main();

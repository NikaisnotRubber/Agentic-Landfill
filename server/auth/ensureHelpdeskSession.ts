import fs from "node:fs/promises";

import { DEFAULT_HELPDESK_AUTH_CONFIG_PATH } from "./defaultHelpdeskAuthConfigPath";
import { loginAndSaveState as loginAndSaveStateImpl } from "./loginAndSaveState";

type EnsureHelpdeskSessionOptions = {
  stateFile: string;
  loginAndSaveState?: typeof loginAndSaveStateImpl;
};

export async function ensureHelpdeskSession(
  options: EnsureHelpdeskSessionOptions,
): Promise<void> {
  const loginAndSaveState = options.loginAndSaveState ?? loginAndSaveStateImpl;

  try {
    await fs.access(options.stateFile, fs.constants.R_OK);
    return;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      await loginAndSaveState({
        configPath: DEFAULT_HELPDESK_AUTH_CONFIG_PATH,
      });

      try {
        await fs.access(options.stateFile, fs.constants.R_OK);
      } catch (stateFileAccessError) {
        if (
          typeof stateFileAccessError === "object" &&
          stateFileAccessError !== null &&
          "code" in stateFileAccessError &&
          (stateFileAccessError as NodeJS.ErrnoException).code === "ENOENT"
        ) {
          throw new Error(
            `Helpdesk session bootstrap did not create the requested state file: ${options.stateFile}`,
          );
        }

        throw stateFileAccessError;
      }

      return;
    }

    throw error;
  }
}

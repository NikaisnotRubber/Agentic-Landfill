import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { loadHelpdeskAuthConfig } from "../server/auth/helpdeskConfig";

describe("loadHelpdeskAuthConfig", () => {
  it("loads YAML auth config and applies defaults", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "helpdesk-auth-config-"));
    const configPath = path.join(tempDir, "helpdesk-auth.local.yaml");

    await writeFile(
      configPath,
      [
        "username: JIAHUA.WU",
        "password: secret",
        "stateFile: IT工單(不可用，僅供參考)/delta_sso_state.json",
      ].join("\n"),
      "utf8",
    );

    const config = await loadHelpdeskAuthConfig(configPath);

    expect(config).toEqual({
      baseUrl: "https://ithelpdesk.deltaww.com/",
      username: "JIAHUA.WU",
      password: "secret",
      domain: "DELTA",
      stateFile: path.resolve(process.cwd(), "IT工單(不可用，僅供參考)", "delta_sso_state.json"),
      headless: false,
    });
  });

  it("throws when required credentials are missing", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "helpdesk-auth-config-"));
    const configPath = path.join(tempDir, "helpdesk-auth.local.yaml");

    await writeFile(configPath, "username: JIAHUA.WU\n", "utf8");

    await expect(loadHelpdeskAuthConfig(configPath)).rejects.toThrow(
      "Missing required helpdesk auth config key: password",
    );
  });
});

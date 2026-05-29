import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_HELPDESK_AUTH_CONFIG_PATH } from "../server/auth/defaultHelpdeskAuthConfigPath";
import { ensureHelpdeskSession } from "../server/auth/ensureHelpdeskSession";

describe("DEFAULT_HELPDESK_AUTH_CONFIG_PATH", () => {
  it("points to config/helpdesk-auth.yaml under the current working directory", () => {
    expect(DEFAULT_HELPDESK_AUTH_CONFIG_PATH).toBe(
      path.resolve(process.cwd(), "config", "helpdesk-auth.yaml"),
    );
  });
});

describe("ensureHelpdeskSession", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("bootstraps login when the storage state file does not exist", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "helpdesk-session-"));
    const missingStateFile = path.join(tempDir, "missing-state.json");
    const accessSpy = vi.spyOn(fs, "access");
    const loginAndSaveState = vi.fn().mockImplementation(async () => {
      await fs.writeFile(
        missingStateFile,
        "{\"cookies\":[],\"origins\":[]}\n",
        "utf8",
      );

      return {
        ok: true,
        stateFile: missingStateFile,
        baseUrl: "https://ithelpdesk.deltaww.com/",
      };
    });

    await ensureHelpdeskSession({
      stateFile: missingStateFile,
      loginAndSaveState,
    });

    expect(loginAndSaveState).toHaveBeenCalledWith({
      configPath: DEFAULT_HELPDESK_AUTH_CONFIG_PATH,
    });
    expect(accessSpy).toHaveBeenNthCalledWith(
      1,
      missingStateFile,
      fs.constants.R_OK,
    );
    expect(accessSpy).toHaveBeenNthCalledWith(
      2,
      missingStateFile,
      fs.constants.R_OK,
    );
  });

  it("rejects when bootstrap returns without creating the requested state file", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "helpdesk-session-"));
    const missingStateFile = path.join(tempDir, "missing-state.json");
    const accessSpy = vi.spyOn(fs, "access");
    const loginAndSaveState = vi.fn().mockResolvedValue({
      ok: true,
      stateFile: path.join(tempDir, "different-state.json"),
      baseUrl: "https://ithelpdesk.deltaww.com/",
    });

    await expect(
      ensureHelpdeskSession({
        stateFile: missingStateFile,
        loginAndSaveState,
      }),
    ).rejects.toThrow(
      `Helpdesk session bootstrap did not create the requested state file: ${missingStateFile}`,
    );

    expect(loginAndSaveState).toHaveBeenCalledWith({
      configPath: DEFAULT_HELPDESK_AUTH_CONFIG_PATH,
    });
    expect(accessSpy).toHaveBeenNthCalledWith(
      1,
      missingStateFile,
      fs.constants.R_OK,
    );
    expect(accessSpy).toHaveBeenNthCalledWith(
      2,
      missingStateFile,
      fs.constants.R_OK,
    );
  });

  it("does nothing when the storage state file already exists", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "helpdesk-session-"));
    const existingStateFile = path.join(tempDir, "state.json");
    await fs.writeFile(existingStateFile, "{\"cookies\":[],\"origins\":[]}\n", "utf8");
    const accessSpy = vi.spyOn(fs, "access");
    const loginAndSaveState = vi.fn();

    await ensureHelpdeskSession({
      stateFile: existingStateFile,
      loginAndSaveState,
    });

    expect(accessSpy).toHaveBeenCalledWith(existingStateFile, fs.constants.R_OK);
    expect(loginAndSaveState).not.toHaveBeenCalled();
  });

  it("surfaces storage state access errors other than file missing", async () => {
    const accessError = Object.assign(new Error("permission denied"), {
      code: "EACCES",
    });
    const accessSpy = vi.spyOn(fs, "access").mockRejectedValue(accessError);
    const loginAndSaveState = vi.fn();

    await expect(
      ensureHelpdeskSession({
        stateFile: "/tmp/does-not-matter.json",
        loginAndSaveState,
      }),
    ).rejects.toThrow("permission denied");

    expect(accessSpy).toHaveBeenCalledWith(
      "/tmp/does-not-matter.json",
      fs.constants.R_OK,
    );
    expect(loginAndSaveState).not.toHaveBeenCalled();
  });

  it("rethrows unexpected storage state access rejection shapes", async () => {
    const accessError = new Error("boom");
    const accessSpy = vi.spyOn(fs, "access").mockRejectedValue(accessError);
    const loginAndSaveState = vi.fn();

    await expect(
      ensureHelpdeskSession({
        stateFile: "/tmp/does-not-matter.json",
        loginAndSaveState,
      }),
    ).rejects.toThrow("boom");

    expect(accessSpy).toHaveBeenCalledWith(
      "/tmp/does-not-matter.json",
      fs.constants.R_OK,
    );
    expect(loginAndSaveState).not.toHaveBeenCalled();
  });
});

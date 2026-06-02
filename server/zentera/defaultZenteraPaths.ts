import path from "node:path";

export const DEFAULT_ZENTERA_DATA_DIR = path.resolve(
  process.cwd(),
  "Mapping ADGroup、Zentera",
);

export const DEFAULT_USER_ROLES_FILE = "User_Roles_202603231446.csv";
export const DEFAULT_SERVER_PROFILES_FILE = "Server_Profiles_202603231446.csv";

export function resolveZenteraDataPaths(dataDir = process.env.ZENTERA_DATA_DIR?.trim() || DEFAULT_ZENTERA_DATA_DIR) {
  return {
    dataDir,
    userRolesPath: path.join(
      dataDir,
      process.env.ZENTERA_USER_ROLES_FILE?.trim() || DEFAULT_USER_ROLES_FILE,
    ),
    serverProfilesPath: path.join(
      dataDir,
      process.env.ZENTERA_SERVER_PROFILES_FILE?.trim() || DEFAULT_SERVER_PROFILES_FILE,
    ),
  };
}

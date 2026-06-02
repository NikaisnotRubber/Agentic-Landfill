export type ZenteraIndexes = {
  /** Manager or user account (uppercase) → assigned Zentera Role names. */
  rolesByUser: Map<string, Set<string>>;
  /** Zentera Role → VM hostnames (sorted, unique). */
  hostnamesByRole: Map<string, string[]>;
  /** VM hostname (uppercase) → Application(Server Group) / Zentera Role name. */
  roleByHostname: Map<string, string>;
  /** VM hostname (uppercase) → App Profile (Excel Application column). */
  appProfileByHostname: Map<string, string>;
};

export type ZenteraExportFields = {
  role: string;
  application: string;
  userRoles: string;
};

export type VmHostnameLookupResult = {
  vmHostname: string;
  source: "description" | "zentera" | "";
  candidateHostnames: string[];
  hadMultipleCandidates: boolean;
};

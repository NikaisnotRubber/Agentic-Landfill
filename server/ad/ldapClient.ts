import { Client } from "ldapts";

import { normalizeAdEntry, type NormalizedAdEntry } from "./normalizeAdEntry";
import {
  runWindowsIntegratedLookup,
  type IntegratedLookupArgs,
} from "./windowsIntegratedLookup";

const DEFAULT_DC_HOST = "TWTPEDCS02";
const DEFAULT_BASE_DN = "DC=delta,DC=corp";

const USER_ATTRIBUTES = [
  "sAMAccountName",
  "cn",
  "mail",
  "department",
  "manager",
  "extensionAttribute15",
  "extensionAttribute1",
  "extensionAttribute2",
] as const;

type SearchResult = {
  searchEntries: Record<string, unknown>[];
};

type LdapClientLike = {
  bind: (dn: string, password: string) => Promise<void>;
  search: (
    baseDn: string,
    options: {
      scope: "sub";
      filter: string;
      attributes: readonly string[];
    },
  ) => Promise<SearchResult>;
  unbind: () => Promise<void>;
};

type LdapFactory = (options: { url: string }) => LdapClientLike;

type AdEnv = Partial<{
  AD_DC: string;
  AD_BASE_DN: string;
  AD_USER: string;
  AD_PASSWORD: string;
}>;

export type AdLookupClient = {
  lookupUser: (account: string) => Promise<NormalizedAdEntry | null>;
  close: () => Promise<void>;
};

type CreateAdLookupClientOptions = {
  env?: AdEnv;
  platform?: NodeJS.Platform;
  ldapFactory?: LdapFactory;
  runIntegratedLookup?: (args: IntegratedLookupArgs) => Promise<NormalizedAdEntry | null>;
};

function escapeLdapFilterValue(value: string): string {
  return value
    .replaceAll("\\", "\\5c")
    .replaceAll("*", "\\2a")
    .replaceAll("(", "\\28")
    .replaceAll(")", "\\29")
    .replaceAll("\u0000", "\\00");
}

export function createAdLookupClient(
  options: CreateAdLookupClientOptions = {},
): AdLookupClient {
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  const dcHost = env.AD_DC?.trim() || DEFAULT_DC_HOST;
  const baseDn = env.AD_BASE_DN?.trim() || DEFAULT_BASE_DN;
  const bindUser = env.AD_USER?.trim() ?? "";
  const bindPassword = env.AD_PASSWORD ?? "";
  const hasSimpleBindCredentials = Boolean(bindUser && bindPassword);
  const ldapFactory: LdapFactory =
    options.ldapFactory ?? ((clientOptions) => new Client(clientOptions));
  const integratedLookup = options.runIntegratedLookup ?? runWindowsIntegratedLookup;

  let simpleClient: LdapClientLike | null = null;

  async function ensureSimpleClient(): Promise<LdapClientLike> {
    if (simpleClient) {
      return simpleClient;
    }

    if (!hasSimpleBindCredentials) {
      throw new Error("No supported LDAP authentication method is configured.");
    }

    const client = ldapFactory({ url: `ldap://${dcHost}` });
    await client.bind(bindUser, bindPassword);
    simpleClient = client;
    return client;
  }

  async function lookupWithSimpleBind(account: string): Promise<NormalizedAdEntry | null> {
    const client = await ensureSimpleClient();
    const { searchEntries } = await client.search(baseDn, {
      scope: "sub",
      filter: `(sAMAccountName=${escapeLdapFilterValue(account)})`,
      attributes: USER_ATTRIBUTES,
    });

    const [firstEntry] = searchEntries;
    return firstEntry ? normalizeAdEntry(firstEntry) : null;
  }

  return {
    async lookupUser(account: string) {
      const normalizedAccount = account.trim();
      if (!normalizedAccount) {
        return null;
      }

      if (platform === "win32") {
        try {
          return await integratedLookup({
            account: normalizedAccount,
            dcHost,
            baseDn,
          });
        } catch (error) {
          if (!hasSimpleBindCredentials) {
            const message = error instanceof Error ? error.message : "Unknown integrated lookup error";
            throw new Error(`Integrated AD lookup failed: ${message}`);
          }
        }
      }

      if (!hasSimpleBindCredentials) {
        throw new Error("No supported LDAP authentication method is configured.");
      }

      return lookupWithSimpleBind(normalizedAccount);
    },

    async close() {
      if (!simpleClient) {
        return;
      }

      await simpleClient.unbind();
      simpleClient = null;
    },
  };
}

# Helpdesk Ticket AD Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an `Enrich Current Tickets` feature that augments the current Helpdesk result set with requester details from Active Directory.

**Architecture:** Keep the existing Vite middleware pattern. Add focused AD service modules under `server/ad/`, expose a thin `/api/tickets/enrich-ad` endpoint, and extend the current Vue UI to request enrichment and render nested AD data per ticket.

**Tech Stack:** TypeScript, Vue 3, Vite middleware, Vitest, `ldapts`, Windows PowerShell integration for integrated-auth path

---

### Task 1: Establish repository hygiene and a clean baseline

**Files:**
- Create: `.gitignore`
- Modify: `package.json`

- [ ] **Step 1: Add repository ignore rules**

```gitignore
node_modules/
dist/
.vite/
coverage/
*.log
.DS_Store
```

- [ ] **Step 2: Run the current test suite as a baseline**

Run: `pnpm test`
Expected: existing tests pass before AD feature work starts

- [ ] **Step 3: Record the baseline in git**

Run:

```bash
git add .gitignore package.json pnpm-lock.yaml src server tests vite.config.ts docs
git commit -m "chore: initialize local repository baseline"
```

Expected: a first local commit exists before feature changes

### Task 2: Add requester parsing and AD record normalization helpers

**Files:**
- Create: `server/ad/requesterParser.ts`
- Create: `server/ad/normalizeAdEntry.ts`
- Test: `tests/adParsing.test.ts`

- [ ] **Step 1: Write failing tests for requester parsing and attribute normalization**

```ts
import { describe, expect, it } from "vitest";

import { extractRequesterAccount } from "../server/ad/requesterParser";
import { normalizeAdEntry } from "../server/ad/normalizeAdEntry";

describe("extractRequesterAccount", () => {
  it("returns the first token from a standard requester string", () => {
    expect(extractRequesterAccount("JIAHUA.WU 吳家驊")).toBe("JIAHUA.WU");
  });

  it("returns an empty string for blank requester values", () => {
    expect(extractRequesterAccount("")).toBe("");
  });
});

describe("normalizeAdEntry", () => {
  it("reduces manager DN and trims BG/BU suffixes", () => {
    expect(
      normalizeAdEntry({
        sAMAccountName: "JIAHUA.WU",
        cn: "吳家驊",
        manager: "CN=王小明,OU=Users,DC=delta,DC=corp",
        extensionAttribute1: "LTW/Infra",
        extensionAttribute2: "IT/Support",
      }),
    ).toMatchObject({
      adAccount: "JIAHUA.WU",
      manager: "王小明",
      bg: "LTW",
      bu: "IT",
    });
  });
});
```

- [ ] **Step 2: Run the new tests and confirm they fail**

Run: `pnpm test tests/adParsing.test.ts`
Expected: FAIL because the new helper modules do not exist yet

- [ ] **Step 3: Implement the minimal helper modules**

```ts
// server/ad/requesterParser.ts
export function extractRequesterAccount(requester: string): string {
  return requester.trim().split(/\s+/)[0] ?? "";
}

// server/ad/normalizeAdEntry.ts
function extractCn(value: string): string {
  const match = /CN=([^,]+)/i.exec(value);
  return match?.[1] ?? value;
}

function trimSlashValue(value: string): string {
  return value.includes("/") ? value.split("/")[0] : value;
}

export function normalizeAdEntry(entry: Record<string, unknown>) {
  const read = (key: string) => {
    const value = entry[key];
    return typeof value === "string" ? value : "";
  };

  const manager = read("manager");

  return {
    adAccount: read("sAMAccountName"),
    displayName: read("cn"),
    mail: read("mail"),
    department: read("department"),
    manager: manager.includes("CN=") ? extractCn(manager) : manager,
    employeeId: read("extensionAttribute15"),
    bg: trimSlashValue(read("extensionAttribute1")),
    bu: trimSlashValue(read("extensionAttribute2")),
  };
}
```

- [ ] **Step 4: Re-run the parser tests**

Run: `pnpm test tests/adParsing.test.ts`
Expected: PASS

- [ ] **Step 5: Commit the helper layer**

```bash
git add server/ad/requesterParser.ts server/ad/normalizeAdEntry.ts tests/adParsing.test.ts
git commit -m "test: add AD parsing and normalization helpers"
```

### Task 3: Add LDAP client strategies and lookup contract

**Files:**
- Create: `server/ad/ldapClient.ts`
- Test: `tests/adLdapClient.test.ts`

- [ ] **Step 1: Write failing tests for simple-bind lookup and unsupported integrated-auth fallback**

```ts
import { describe, expect, it, vi } from "vitest";

import { createAdLookupClient } from "../server/ad/ldapClient";

describe("createAdLookupClient", () => {
  it("uses simple bind when credentials are configured", async () => {
    const search = vi.fn().mockResolvedValue({
      searchEntries: [{ sAMAccountName: "JIAHUA.WU", cn: "吳家驊" }],
    });

    const client = createAdLookupClient({
      ldapFactory: () => ({
        bind: vi.fn().mockResolvedValue(undefined),
        search,
        unbind: vi.fn().mockResolvedValue(undefined),
      }),
      env: {
        AD_DC: "twtpedcs02",
        AD_BASE_DN: "DC=delta,DC=corp",
        AD_USER: "DELTA\\svc_account",
        AD_PASSWORD: "secret",
      },
      platform: "linux",
    });

    const result = await client.lookupUser("JIAHUA.WU");
    expect(result.displayName).toBe("吳家驊");
  });
});
```

- [ ] **Step 2: Run the LDAP client tests and confirm failure**

Run: `pnpm test tests/adLdapClient.test.ts`
Expected: FAIL because the LDAP client module does not exist yet

- [ ] **Step 3: Implement the LDAP lookup client**

```ts
import { Client } from "ldapts";

import { normalizeAdEntry } from "./normalizeAdEntry";

export function createAdLookupClient(deps = {}) {
  // create a lookup client that:
  // 1. validates AD_DC / AD_BASE_DN
  // 2. on win32 attempts integrated-auth adapter first
  // 3. otherwise falls back to ldapts simple bind when AD_USER / AD_PASSWORD exist
  // 4. exposes lookupUser(account) and close()
}
```

Implementation details:
- Use `ldapts` for simple bind and subtree search
- Search filter: `(sAMAccountName=${account})`
- Attributes: `sAMAccountName`, `cn`, `mail`, `department`, `manager`, `extensionAttribute15`, `extensionAttribute1`, `extensionAttribute2`
- On `win32`, keep integrated-auth behind a small adapter boundary so the Windows path can use PowerShell/current credentials without leaking into the rest of the service
- Return normalized results using `normalizeAdEntry`

- [ ] **Step 4: Re-run the LDAP client tests**

Run: `pnpm test tests/adLdapClient.test.ts`
Expected: PASS

- [ ] **Step 5: Commit the LDAP client layer**

```bash
git add server/ad/ldapClient.ts tests/adLdapClient.test.ts package.json pnpm-lock.yaml
git commit -m "feat: add LDAP client strategies for AD lookup"
```

### Task 4: Add ticket enrichment orchestration and endpoint coverage

**Files:**
- Create: `server/ad/enrichTicketsWithAd.ts`
- Modify: `server/types.ts`
- Modify: `vite.config.ts`
- Test: `tests/adEnrichment.test.ts`
- Test: `tests/adEndpoint.test.ts`

- [ ] **Step 1: Write failing tests for deduplicated enrichment**

```ts
import { describe, expect, it, vi } from "vitest";

import { enrichTicketsWithAd } from "../server/ad/enrichTicketsWithAd";

describe("enrichTicketsWithAd", () => {
  it("deduplicates requester accounts and merges AD results onto tickets", async () => {
    const lookupUser = vi
      .fn()
      .mockResolvedValueOnce({ adAccount: "JIAHUA.WU", displayName: "吳家驊", manager: "王小明", bg: "LTW", bu: "IT" });

    const result = await enrichTicketsWithAd(
      [
        { id: "1", requester: "JIAHUA.WU 吳家驊", subject: "", technician: "", created_time: "", site: "", category: "", status: "", group: "", short_description: "" },
        { id: "2", requester: "JIAHUA.WU 吳家驊", subject: "", technician: "", created_time: "", site: "", category: "", status: "", group: "", short_description: "" },
      ],
      { lookupUser, close: vi.fn() },
    );

    expect(lookupUser).toHaveBeenCalledTimes(1);
    expect(result.summary.enrichedCount).toBe(2);
    expect(result.tickets[0].ad?.manager).toBe("王小明");
  });
});
```

- [ ] **Step 2: Write failing endpoint tests**

```ts
import { describe, expect, it } from "vitest";

describe("/api/tickets/enrich-ad", () => {
  it("rejects non-POST requests and returns enrichment payloads for POST", () => {
    expect(true).toBe(false);
  });
});
```

- [ ] **Step 3: Run the enrichment tests and confirm failure**

Run: `pnpm test tests/adEnrichment.test.ts tests/adEndpoint.test.ts`
Expected: FAIL because the orchestrator and endpoint do not exist yet

- [ ] **Step 4: Implement the enrichment service**

```ts
export async function enrichTicketsWithAd(tickets, client) {
  // parse requester account
  // deduplicate accounts
  // lookup each unique account
  // attach nested ad payload to each ticket
  // compute summary counts
}
```

- [ ] **Step 5: Extend server types and add the endpoint**

Implementation details:
- add `TicketAdInfo`, `EnrichedTicketRecord`, `TicketAdEnrichmentSuccess`, and `TicketAdEnrichmentFailure` in `server/types.ts`
- add `/api/tickets/enrich-ad` in `vite.config.ts`
- accept only `POST`
- body shape: `{ tickets: TicketRecord[] }`
- return `200` for success and `400`/`500` for malformed or infrastructure failures

- [ ] **Step 6: Re-run enrichment and endpoint tests**

Run: `pnpm test tests/adEnrichment.test.ts tests/adEndpoint.test.ts`
Expected: PASS

- [ ] **Step 7: Commit the backend feature**

```bash
git add server/ad/enrichTicketsWithAd.ts server/types.ts vite.config.ts tests/adEnrichment.test.ts tests/adEndpoint.test.ts
git commit -m "feat: add AD enrichment endpoint"
```

### Task 5: Extend client API, UI state, and rendering

**Files:**
- Modify: `src/lib/api.ts`
- Modify: `src/lib/types.ts`
- Modify: `src/App.vue`
- Test: `tests/adUiState.test.ts`

- [ ] **Step 1: Write failing tests for the new UI interaction state**

```ts
import { describe, expect, it } from "vitest";

describe("AD enrichment UI state", () => {
  it("disables enrichment when there is no current result set", () => {
    expect(true).toBe(false);
  });
});
```

- [ ] **Step 2: Run the UI state test and confirm failure**

Run: `pnpm test tests/adUiState.test.ts`
Expected: FAIL because the test is still a placeholder assertion

- [ ] **Step 3: Add the client API and client-side types**

Implementation details:
- add `enrichCurrentTickets(payload)` in `src/lib/api.ts`
- add client-side mirrors of the new server response types in `src/lib/types.ts`
- keep existing fetch types intact

- [ ] **Step 4: Update the Vue UI**

Implementation details:
- add `enriching` state separate from `loading`
- disable `Enrich Current Tickets` when `result` is missing or enrichment is in flight
- call the enrichment endpoint with `result.tickets`
- replace the current `result` with the enriched payload on success
- add summary rendering for enrichment counts
- add AD columns or an AD detail region in the table for `AD Account`, `CN`, `主管`, `BU`, and `BG`

- [ ] **Step 5: Replace the placeholder UI test with a real one and re-run it**

Run: `pnpm test tests/adUiState.test.ts`
Expected: PASS

- [ ] **Step 6: Commit the UI integration**

```bash
git add src/lib/api.ts src/lib/types.ts src/App.vue tests/adUiState.test.ts
git commit -m "feat: surface AD enrichment in the ticket preview UI"
```

### Task 6: Full verification

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Run the focused test suite**

Run:

```bash
pnpm test
```

Expected: all existing and new Vitest suites pass

- [ ] **Step 2: Run a production build**

Run:

```bash
pnpm build
```

Expected: Vite build succeeds without type or bundling failures

- [ ] **Step 3: Inspect git status**

Run:

```bash
git status --short
```

Expected: only intended files are modified or added

- [ ] **Step 4: Commit the verified feature**

```bash
git add .
git commit -m "feat: add AD enrichment for current helpdesk tickets"
```

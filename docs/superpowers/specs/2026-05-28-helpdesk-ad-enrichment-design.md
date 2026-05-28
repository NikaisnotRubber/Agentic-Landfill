# Helpdesk Ticket AD Enrichment Design

## Goal

Add a local AD enrichment feature to the existing Helpdesk ticket preview app so an operator can fetch or load tickets first, then click one button to enrich the current ticket set with requester information from Active Directory.

## Scope

This version covers:

- A new `Enrich Current Tickets` action in the existing Vue UI
- A new local server API endpoint for AD enrichment
- TypeScript replacement of the current Python `fetch_ad_info.py` user lookup logic
- Requester-to-AD-account extraction from current ticket rows
- AD lookup fields: `AD Account`, `CN`, `Mail`, `部門`, `主管`, `工號`, `BG`, `BU`
- Kerberos-first authentication on supported Windows/domain environments
- Fallback to `AD_USER` / `AD_PASSWORD` simple bind when configured
- Batch enrichment with duplicate-account deduplication
- Visible per-ticket enrichment state plus an overall summary

This version does not cover:

- Group lookup or group-member export
- Excel export
- Interactive login or credential prompts in the UI
- Formal production deployment outside the local Vite operator workflow
- Full parity with every Python CLI mode in `fetch_ad_info.py`

## Existing Context

The current app is a local Vue + Vite + TypeScript operator console:

- [src/App.vue](/home/whitebleach/handovered_from_Justin/src/App.vue:1) renders the UI and already supports `Fetch Live` and `Load Sample`
- [src/lib/api.ts](/home/whitebleach/handovered_from_Justin/src/lib/api.ts:1) calls local middleware endpoints
- [vite.config.ts](/home/whitebleach/handovered_from_Justin/vite.config.ts:1) hosts the local middleware API
- [server/fetchTickets.ts](/home/whitebleach/handovered_from_Justin/server/fetchTickets.ts:1) performs Playwright-backed ticket fetches

The Python source of truth for the AD logic is:

- [AD 群組/fetch_ad_info.py](/home/whitebleach/handovered_from_Justin/AD%20%E7%BE%A4%E7%B5%84/fetch_ad_info.py:1)

This design ports only the user-lookup portion of that script into TypeScript and integrates it into the current app as a second-step enrichment feature.

## User Experience

The operator flow is:

1. Use the existing `Fetch Live` or `Load Sample` action
2. Inspect the ticket rows already loaded into the current page
3. Click `Enrich Current Tickets`
4. Wait for the local server to query AD
5. See the current rows updated with AD enrichment fields and a summary of lookup results

The enrichment action must not re-fetch Helpdesk data. It only operates on the current in-memory ticket set already shown in the UI.

## Architecture

The implementation stays inside the current local Vite-server architecture and adds a focused AD service layer.

### Frontend

- `src/App.vue`
  Adds the new action, loading/error states for enrichment, extra columns or an extra data region for AD fields, and a small summary surface.
- `src/lib/api.ts`
  Adds a new client function that posts the current ticket rows to the local enrichment endpoint.
- `src/lib/types.ts`
  Adds client-side types for enriched tickets, per-ticket AD state, and enrichment summary payloads.

### Server

- `server/ad/requesterParser.ts`
  Extracts the requester AD account using the first-token rule from the Python workflow.
- `server/ad/ldapClient.ts`
  Owns connection creation, bind strategy selection, LDAP search execution, and result normalization.
- `server/ad/enrichTicketsWithAd.ts`
  Accepts the current ticket list, deduplicates requester accounts, batches lookups, and merges the AD result back onto each ticket.
- `vite.config.ts`
  Adds `/api/tickets/enrich-ad` and keeps the HTTP-specific concerns at the edge.

## Data Model

The Helpdesk ticket shape remains intact. Enrichment is attached under a nested `ad` property instead of flattening into the root ticket object.

Each enriched ticket will carry:

- `ad.status`
  One of `enriched`, `missing-requester`, `not-found`, or `lookup-failed`
- `ad.adAccount`
- `ad.displayName`
- `ad.mail`
- `ad.department`
- `ad.manager`
- `ad.employeeId`
- `ad.bg`
- `ad.bu`
- `ad.error`
  Optional short diagnostic text for failed lookups

The endpoint also returns a summary object:

- `totalTickets`
- `uniqueAccounts`
- `enrichedCount`
- `missingRequesterCount`
- `notFoundCount`
- `lookupFailedCount`

This keeps UI reporting separate from row-level details and avoids hiding partial failures.

## LDAP Field Mapping

The TypeScript port follows the Python field mapping in `fetch_ad_info.py`:

- `sAMAccountName` -> `adAccount`
- `cn` -> `displayName`
- `mail` -> `mail`
- `department` -> `department`
- `manager` -> `manager`
- `extensionAttribute15` -> `employeeId`
- `extensionAttribute1` -> `bg`
- `extensionAttribute2` -> `bu`

Normalization rules also follow the Python script:

- `manager` values that look like a DN are reduced to `CN`
- `BG` and `BU` values split on `/` and keep the first segment
- missing values normalize to empty strings

## Requester Parsing

The first version uses the same assumption as the Python batch mode:

- if `ticket.requester` exists, use the first whitespace-delimited token as the AD account
- otherwise mark the ticket as `missing-requester`

This keeps behavior aligned with the existing reference flow and avoids inventing more parsing rules before real data proves they are needed.

## Authentication Strategy

The server must support two bind strategies in this order:

1. Kerberos-first on supported Windows/domain environments
2. Fallback to simple bind when `AD_USER` and `AD_PASSWORD` are available

Configuration inputs:

- `AD_DC`
- `AD_BASE_DN`
- `AD_USER`
- `AD_PASSWORD`

Behavioral rules:

- if Kerberos bind succeeds, use it for the lookup session
- if Kerberos bind fails and simple bind credentials are configured, retry with simple bind
- if both paths fail, return a top-level API failure with a precise error message
- the UI will surface bind or connectivity errors as request failure, not as per-ticket row failures

The design accepts that Kerberos support in the Node ecosystem may be platform-sensitive. The service boundary keeps that concern inside the LDAP client module so the rest of the feature remains stable.

## Data Flow

1. Frontend collects the current `tickets` already in memory
2. Frontend posts those tickets to `/api/tickets/enrich-ad`
3. Server parses requester AD accounts from the posted tickets
4. Server deduplicates accounts before querying LDAP
5. Server performs one user lookup per unique AD account
6. Server merges normalized AD results back onto every ticket that referenced that account
7. Server returns enriched tickets plus a summary
8. Frontend replaces the current result set with the enriched version and displays the summary

## Error Handling

There are three error tiers.

### Request-level failures

These fail the entire enrichment request:

- LDAP server unreachable
- bind failure for both Kerberos and simple bind
- malformed request payload
- missing required LDAP configuration such as `AD_BASE_DN`

The endpoint returns `ok: false` with a clear `error` message. The UI shows the error in the existing status band style.

### Row-level failures

These still allow overall success:

- requester missing
- requester parsed but AD entry not found
- single-account lookup failed after the session was established

These are attached to `ticket.ad.status` and included in the summary counts.

### Empty-state behavior

- no tickets loaded: the UI will disable `Enrich Current Tickets`
- empty ticket array posted accidentally: the endpoint returns a valid empty success payload

## Testing Strategy

Implementation must follow TDD and cover the core behavior before UI polish.

### Pure logic tests

- requester parsing extracts the first token from standard requester strings
- DN manager values normalize to `CN`
- `BG` and `BU` values truncate on `/`
- entry normalization returns empty strings for missing attributes

### Service tests

- duplicate requester accounts trigger only one LDAP lookup
- row results correctly map to `enriched`, `missing-requester`, and `not-found`
- summary counts are correct for mixed result sets

### API tests

- `/api/tickets/enrich-ad` rejects non-POST requests
- malformed payloads return failure
- successful requests return enriched tickets and summary

### UI tests

- `Enrich Current Tickets` is disabled when no result set exists
- the UI renders enrichment summary after a successful response
- enriched AD fields appear for current rows without replacing Helpdesk fields

## File Plan

Expected file changes:

- Modify: [src/App.vue](/home/whitebleach/handovered_from_Justin/src/App.vue:1)
- Modify: [src/lib/api.ts](/home/whitebleach/handovered_from_Justin/src/lib/api.ts:1)
- Modify: [src/lib/types.ts](/home/whitebleach/handovered_from_Justin/src/lib/types.ts:1)
- Modify: [vite.config.ts](/home/whitebleach/handovered_from_Justin/vite.config.ts:1)
- Create: `server/ad/requesterParser.ts`
- Create: `server/ad/ldapClient.ts`
- Create: `server/ad/enrichTicketsWithAd.ts`
- Add tests under `tests/` for parser, normalization, service behavior, and endpoint behavior

## Constraints and Non-Goals

- Keep the feature local-first and compatible with the current Vite operator workflow
- Do not port unrelated Python CLI behaviors
- Do not introduce a second backend framework
- Do not re-fetch tickets during enrichment
- Do not flatten AD data into root ticket properties

## Open Implementation Notes

- Kerberos support will be implemented behind a dedicated adapter boundary so the LDAP client contract stays stable even if the concrete Node-side Kerberos package changes during implementation.
- If Kerberos support is not viable in the target environment, the fallback path remains simple bind without changing the UI or enrichment orchestration contracts.

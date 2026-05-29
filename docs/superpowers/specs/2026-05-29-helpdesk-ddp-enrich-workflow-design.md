# Helpdesk DDP Filter And Enrichment Workflow Design

## Goal

Integrate three operator-facing improvements into the merged Helpdesk tool:

- apply a shared `DDP` subject filter to both live and sample ticket fetches
- add a new `Fetch + Enrich` workflow that fetches tickets and then performs AD enrichment in one action
- add a dedicated usage document describing the end-to-end Helpdesk workflow

## Scope

This version covers:

- a reusable subject-filter module that keeps only tickets whose `subject` contains uppercase `DDP`
- applying that filter to both [server/fetchTickets.ts](/home/whitebleach/handovered_from_Justin/server/fetchTickets.ts:1) and [server/sampleTickets.ts](/home/whitebleach/handovered_from_Justin/server/sampleTickets.ts:1)
- a new orchestration path that runs `fetchTickets -> enrichTicketsWithAd`
- a new UI action alongside the existing `Fetch Live`, `Load Sample`, and `Enrich Current Tickets` controls
- partial-success behavior where ticket fetch success is preserved even if AD enrichment fails
- a standalone usage guide at `docs/helpdesk-workflow.md`

This version does not cover:

- deleting or cleaning up the old `helpdesk-login-automation` worktree
- changing the existing manual `Enrich Current Tickets` semantics
- changing the LDAP lookup fields or AD mapping logic
- making `DDP` filtering configurable in the first version
- changing the case-sensitivity rule for `DDP`

## Existing Context

The current merged app already has:

- [server/fetchTickets.ts](/home/whitebleach/handovered_from_Justin/server/fetchTickets.ts:1)
  which fetches live Helpdesk tickets, auto-refreshes session state, and normalizes the API payload
- [server/sampleTickets.ts](/home/whitebleach/handovered_from_Justin/server/sampleTickets.ts:1)
  which loads a local sample ticket fixture and normalizes it
- [server/ad/enrichAdRoute.ts](/home/whitebleach/handovered_from_Justin/server/ad/enrichAdRoute.ts:1)
  which enriches an already-fetched ticket list with AD data
- [src/App.vue](/home/whitebleach/handovered_from_Justin/src/App.vue:1)
  which exposes `Fetch Live`, `Load Sample`, and `Enrich Current Tickets`
- [src/lib/api.ts](/home/whitebleach/handovered_from_Justin/src/lib/api.ts:1)
  which provides separate fetch and enrichment client calls

What is missing today:

- no shared `DDP` filter
- no one-click `Fetch + Enrich` flow
- no operator document for the merged workflow

## User Experience

After this change, the operator experience becomes:

1. `Fetch Live`
   returns only tickets whose subject contains uppercase `DDP`
2. `Load Sample`
   returns only sample tickets whose subject contains uppercase `DDP`
3. `Enrich Current Tickets`
   keeps its current behavior and enriches whatever tickets are already loaded
4. `Fetch + Enrich`
   fetches tickets first, then automatically runs AD enrichment on the filtered result

If the fetch portion fails, the result is a normal fetch failure.

If the fetch portion succeeds but AD enrichment fails:

- the filtered tickets are still shown
- the result remains `ok: true`
- the UI shows an AD-enrichment warning instead of treating the whole workflow as failed

## DDP Filter Rules

The first version uses one explicit rule:

- keep a ticket only when `ticket.subject.includes("DDP")` is true

Important boundary choices:

- case-sensitive
- no regex word-boundary requirement
- matching `ABCDDPXYZ` is allowed
- lowercase `ddp` does not match

This is intentionally simple because the user explicitly wants a substring rule, not a looser heuristic.

## Architecture

The implementation will keep fetching and enrichment separate, and add a thin orchestration layer.

### New / Changed Units

- `server/helpdeskFilters.ts`
  owns the `DDP` subject filter and any shared ticket-filter helpers
- `server/fetchTickets.ts`
  remains the live fetch core, then applies the shared filter before returning success
- `server/sampleTickets.ts`
  applies the same shared filter to the sample dataset
- `server/fetchAndEnrichTickets.ts`
  orchestrates:
  1. fetch tickets
  2. if fetch succeeds, run AD enrichment
  3. if enrichment fails, preserve the tickets and attach a warning
- `vite.config.ts`
  adds a new route for the combined workflow, instead of overloading the current fetch endpoint
- `src/lib/api.ts`
  adds a client helper for the new combined endpoint
- `src/App.vue`
  adds a new `Fetch + Enrich` action and a visible warning area for partial AD failure
- `docs/helpdesk-workflow.md`
  documents setup and daily operator flows

This keeps `fetchTickets` focused on ticket retrieval and makes the new combined behavior explicit instead of burying it inside the core fetch function.

## API Shape

The existing success payload shape already allows AD metadata:

- `tickets`
- `adSummary`

This design adds one optional success-only field:

- `adWarning?: string`

So the success semantics become:

- `ok: true` means ticket fetch succeeded
- `adSummary` exists when enrichment succeeded
- `adWarning` exists when enrichment did not fully complete

This preserves the user’s requirement that fetch success must not be hidden by AD failure.

## Data Flow

### `Fetch Live`

1. receive fetch request
2. ensure session / fetch Helpdesk API / normalize records
3. apply `DDP` filter
4. return filtered tickets

### `Load Sample`

1. read sample fixture
2. normalize records
3. apply `DDP` filter
4. return filtered tickets

### `Fetch + Enrich`

1. run the same server-side fetch flow used by `Fetch Live`
2. if fetch fails, return that failure
3. if fetch succeeds, pass the filtered tickets into the existing AD enrichment pipeline
4. if enrichment succeeds:
   - return enriched tickets
   - include `adSummary`
5. if enrichment fails:
   - return the filtered non-enriched tickets
   - attach `adWarning`
   - do not convert the response into `ok: false`

This keeps the partial-success boundary explicit and easy for the UI to consume.

## UI Behavior

The current controls remain, and one new action is added:

- `Fetch Live`
- `Load Sample`
- `Fetch + Enrich`
- `Enrich Current Tickets`

UI rules:

- `Fetch + Enrich` is disabled while a fetch or combined fetch/enrich request is in flight
- the existing `Enrich Current Tickets` button remains available after normal fetches
- if `adWarning` is present, show a warning band without clearing the successful ticket table
- the ticket table does not need a separate visual mode for combined results; the presence or absence of `ticket.ad` already expresses that state

## Error Handling

### Fetch failure

- normal failure response
- no AD lookup attempted

### Enrichment failure during `Fetch + Enrich`

- success response is still returned
- warning text is attached in `adWarning`
- `tickets` remain visible

### Empty filtered result

- still `ok: true`
- `count` becomes `0`
- no enrichment should run when there are no tickets to enrich

### Sample/live consistency

- both entrypoints must use the same filter helper
- the rule must not be duplicated in two places

## Testing Strategy

Implementation must follow TDD.

### Filter tests

- uppercase `DDP` matches
- lowercase `ddp` does not match
- embedded substring like `ABCDDPXYZ` matches
- empty or non-matching subjects are excluded

### Fetch tests

- live fetch success returns only `DDP` subject tickets
- malformed or failed live payload behavior remains intact

### Sample tests

- sample fixture loading returns only `DDP` subject tickets

### Combined orchestration tests

- fetch success + enrich success -> enriched success payload
- fetch success + enrich failure -> success payload with original tickets and `adWarning`
- fetch failure -> enrichment not called
- zero filtered tickets -> enrichment not called

### UI tests

- new `Fetch + Enrich` action uses the combined API helper
- warning band appears when `adWarning` exists
- existing manual enrichment flow still works

### Documentation verification

- command names match `package.json`
- config file names match the merged auth flow
- state file path examples match current implementation defaults

## Documentation Plan

The new `docs/helpdesk-workflow.md` should cover:

- required local files
  - `config/helpdesk-auth.yaml`
  - `IT工單(不可用，僅供參考)/delta_sso_state.json`
- how to bootstrap login manually
- how `Fetch Live`, `Load Sample`, `Fetch + Enrich`, and `Enrich Current Tickets` differ
- that `DDP` filtering is applied automatically to both live and sample fetches
- how partial AD-enrichment failure is shown

This document is meant for operators, not contributors, so it should stay practical and command-oriented.

## Cleanup Boundary

The old `helpdesk-login-automation` worktree cleanup is intentionally deferred until after:

- this feature set is implemented
- the merged branch is verified
- the user confirms cleanup

That cleanup should be handled as a separate operational step, not mixed into this feature implementation.

## Constraints And Non-Goals

- do not add a user-configurable `DDP` pattern in this version
- do not silently change the existing manual enrichment endpoint contract
- do not turn AD enrichment failure into a fetch failure for the combined workflow
- do not remove the ability to inspect non-enriched tickets before enrichment

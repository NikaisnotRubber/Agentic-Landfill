# Helpdesk Processed DDP View Design

## Summary

This spec defines the next integration phase for the Helpdesk web project.

The goal is to align the project with the original `IT工單(不可用，僅供參考)` workflow order without jumping straight to Excel export.

Phase 1 will:

- add status-cell background colors in the existing raw ticket table
- add new-ticket detection aligned with `last_seen_id.txt`
- port the DDP parsing logic from `process_ddp_tickets.py` into server-side TypeScript
- expose a dedicated `Processed DDP View` in the UI

This phase will not yet implement Excel export, SharePoint download, or Windows scheduler wrappers.

## Scope

### In scope

- status background colors for the existing raw ticket table
- a server-side DDP parsing pipeline
- a server-side new-ticket tracker
- a new processed-results payload returned alongside fetched tickets
- a UI toggle between raw tickets and processed DDP rows
- processed-row abnormal flags for core data quality checks

### Out of scope

- Excel workbook generation
- SharePoint file download
- Windows Task Scheduler integration
- desktop retry dialogs for locked files
- porting every single legacy Excel-only column in phase 1

## Current State

The web project already supports:

- Helpdesk login bootstrap and session refresh
- live ticket fetch
- sample ticket load
- uppercase `DDP` subject filtering
- LDAP / AD enrichment
- one-click `Fetch + Enrich`

The reference Python workflow still contains capabilities that are not yet represented in the web app:

- `last_seen_id.txt` new-ticket detection
- `short_description` parsing into structured DDP fields
- processed abnormal-flag logic
- Excel-oriented processing output

## Goals

Phase 1 should let an operator:

1. fetch current DDP tickets
2. see which tickets are newly observed
3. inspect a processed DDP view derived from `short_description`
4. compare processed rows against the raw ticket source
5. keep using AD enrichment where available

## Architecture

The implementation will add a dedicated DDP processing layer on the server.

### Server modules

- `server/ddp/parseDdpTicket.ts`
  - parses one ticket into a processed DDP row
  - ports the core regex and normalization logic from `process_ddp_tickets.py`

- `server/ddp/processDdpTickets.ts`
  - processes a batch of fetched tickets
  - returns processed rows plus a processing summary

- `server/ddp/newTicketTracker.ts`
  - mirrors `last_seen_id.txt` behavior
  - detects newly observed tickets
  - updates the tracker file after a successful fetch result

- `server/fetchProcessAndEnrich.ts`
  - orchestration layer for:
    - fetch
    - DDP filter
    - new-ticket detection
    - DDP processing
    - optional AD enrichment merge

### Client modules

- `src/lib/types.ts`
  - extends client payload types with processed-row data and new-ticket summary

- `src/App.vue`
  - adds a view toggle:
    - `Raw Tickets`
    - `Processed DDP View`
  - adds a processed-results table
  - adds status-cell background styling in the raw ticket table

## Data Flow

### `Fetch Live`

1. fetch live tickets
2. apply uppercase `DDP` subject filtering
3. run new-ticket detection
4. run DDP processing
5. return:
   - raw ticket result
   - processed DDP rows
   - new-ticket summary

### `Fetch + Enrich`

1. fetch live tickets
2. apply uppercase `DDP` subject filtering
3. run new-ticket detection
4. run DDP processing
5. run AD enrichment
6. merge AD values into both raw ticket results and processed rows where applicable
7. return:
   - raw ticket result
   - processed DDP rows
   - new-ticket summary
   - AD summary and optional `adWarning`

### `Load Sample`

1. load the checked-in sample fixture
2. apply uppercase `DDP` subject filtering
3. skip tracker persistence by default
4. run DDP processing
5. return:
   - raw ticket result
   - processed DDP rows

## Processed Row Shape

Phase 1 will return a processed row type close to the legacy Python flow, but reduced to the fields that matter most for web review.

Each processed row will include:

- `ticketId`
- `status`
- `subject`
- `requester`
- `isNewTicket`
- `adAccount`
- `adName`
- `firstName`
- `lastName`
- `mail`
- `bu`
- `nbHostname`
- `vmHostname`
- `abnormalFlags`

Optional fields may also carry raw parsing hints when useful for debugging, but these should not become UI clutter by default.

## Parsing Rules

The TypeScript parser will follow the legacy Python ordering and fallback logic as closely as possible.

### Core rules

- normalize mixed Chinese / ASCII spacing before regex extraction
- extract requester account and Chinese name from the `requester` field
- extract:
  - AD account
  - mail
  - NB hostname
  - VM hostname
  from `short_description`
- prefer `requester` AD account only when it matches the description-derived account or clearly appears inside the description text
- derive:
  - `firstName`
  - `lastName`
  from Chinese name first, otherwise from dotted AD account
- if mail is missing but AD account exists, default to `{adAccount}@deltaww.com`

### Phase 1 omitted legacy fields

These legacy workbook-oriented fields remain out of scope for phase 1 UI:

- `Role`
- `Group Owner`
- `Group Name`
- `NAS Folder Name`
- `NEW VM`
- `User Roles`
- `Application`
- `Template Name`
- `Location`

They may still be modeled later if needed for Excel export.

## New-Ticket Detection

The tracker will mirror the legacy Python behavior:

- tracker file path defaults to `IT工單(不可用，僅供參考)/last_seen_id.txt` unless a project path is introduced later
- the latest fetched ticket ID is compared to the stored ID
- if the tracker file is missing, the first successful fetch initializes it
- if the previous ID is not found within the current fetched batch, emit a warning instead of falsely marking all rows as new

The response will include a summary with at least:

- `latestSeenId`
- `previousSeenId`
- `newTicketCount`
- `trackerWarning?`

Each processed row will also include `isNewTicket`.

## Abnormal Flags

Phase 1 will port the highest-value abnormal checks from the Python flow.

Abnormal flags are added per processed row when:

- `AD Account` is missing
- `NB Hostname` is missing
- `VM HostName` contains an invalid placeholder value

Invalid VM placeholder matching will be case-insensitive and include values such as:

- `hostname`
- `localhost`
- `127.0.0.1`
- `vm`
- `none`
- `na`
- `n/a`
- `tbd`
- `-`
- `host`

Rows with abnormal flags still remain visible and are not treated as fatal processing errors.

## UI Design

### Raw ticket table

The existing raw ticket table remains the default view.

Only the `Status` cell gets background color:

- `Open` -> pale red
- `Closed` -> pale blue
- `Resolved` -> pale yellow

Status matching will be case-insensitive.

No whole-row tinting is added in this phase.

### Processed DDP View

The processed view is a dedicated table, not an extension of the raw ticket table.

The UI will expose a simple toggle:

- `Raw Tickets`
- `Processed DDP View`

The processed table will display at least:

- Ticket ID
- Status
- New
- AD Account
- AD Name
- First Name
- Last Name
- Mail
- BU
- NB Hostname
- VM Hostname
- Abnormal Flags
- Subject

The processed table exists to review structured interpretation, not to mirror the exact final Excel layout.

## Error Handling

### Fetch failure

- preserves the current failure behavior
- no processed rows are returned

### Processing anomalies

- rows remain in the processed result
- issues are represented through `abnormalFlags`
- this is not a fatal API failure

### Tracker failure

- ticket fetch still succeeds
- processed rows still return
- attach a non-fatal warning in the response

### AD enrichment failure

- preserve the current partial-success behavior
- raw tickets and processed rows still render
- use `adWarning` without downgrading the request to failure

## Testing

The phase will include tests for:

- status-to-color mapping
- single-ticket DDP parsing
- invalid VM placeholder detection
- requester-account precedence rules
- new-ticket tracker initialization
- new-ticket tracker mismatch warning when old ID is absent from the fetched batch
- batch processing output
- orchestration payload shape
- UI view toggle behavior
- processed table rendering

## Delivery Boundary

At the end of this phase, the project should support:

- DDP-filtered fetch
- new-ticket detection
- processed DDP web review
- raw and processed side-by-side workflow through a UI toggle

It will not yet replace the legacy Excel maintenance workflow end to end.

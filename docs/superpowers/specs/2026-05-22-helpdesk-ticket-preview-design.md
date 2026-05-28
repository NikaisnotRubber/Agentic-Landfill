# Helpdesk Ticket Preview Design

## Goal

Build a local web application that can fetch Helpdesk tickets through the existing authenticated browser-session flow and preview the cleaned ticket data before any downstream Excel or AD processing.

## Scope

This first version covers:

- A local Vue + Vite + TypeScript preview UI
- A local server-side fetch endpoint that uses Playwright
- Reuse of `IT工單(不可用，僅供參考)/delta_sso_state.json`
- A sample-data fallback using `IT工單(不可用，僅供參考)/delta_tickets_clean.json`
- Clear 401/session-expired error reporting

This first version does not cover:

- Automatic interactive SSO login inside the web UI
- Excel generation
- AD enrichment
- Multi-user deployment

## Architecture

The app runs as a local Vite development server with a small Node-side middleware API. The browser UI calls local endpoints for sample loading and live ticket fetching. The live fetch path is server-side because it must read the storage-state file and use Playwright in a trusted local environment.

The Playwright fetcher reproduces the proven flow from `fetch_tickets_api.py`:

1. Load storage state
2. Open `https://ithelpdesk.deltaww.com/WOListView.do`
3. Fetch `https://ithelpdesk.deltaww.com/api/v3/requests?...` inside the page context
4. Normalize the returned ticket shape
5. Return structured success or a precise auth/session failure

## Components

- `src/`
  Frontend app, preview table, filters, fetch actions, status banner, raw JSON view.
- `server/`
  Local middleware handlers and Playwright-backed ticket fetch service.
- `tests/`
  Focused tests for request URL building, response normalization, and auth-failure detection.

## Data Flow

The UI submits fetch parameters such as `count` and optional `technician` to the local API. The API invokes the Playwright fetcher, which returns normalized ticket rows plus fetch metadata. The UI renders the rows in a searchable table and allows raw-payload inspection for debugging.

If the session is invalid, the API returns a structured auth error instead of partial data. The UI surfaces that error directly and tells the operator that the storage-state file must be refreshed.

## Error Handling

- Missing storage-state file: return local configuration error
- Helpdesk page reachable but API returns 401: return session-expired/auth-invalid error
- Unexpected response shape: return parse/fetch error with a short diagnostic payload
- Empty ticket list: treat as valid success, not failure

## Testing

The first pass will test pure logic before UI polish:

- Build API URL from count and requested fields
- Detect auth failure from Helpdesk API payload
- Normalize nested Helpdesk objects into displayable strings
- Render sample data in the preview UI

# Helpdesk Workflow

## Local files

- `config/helpdesk-auth.yaml`
- `IT工單(不可用，僅供參考)/delta_sso_state.json`

## Bootstrap login

Run:

```bash
pnpm auth:login -- --config config/helpdesk-auth.yaml
```

This writes a verified Playwright storage-state file to the configured `stateFile`.

## Ticket actions

### Fetch Live

- Fetches live Helpdesk tickets
- Auto-refreshes session state if needed
- Keeps only tickets whose subject contains uppercase `DDP`

### Load Sample

- Loads the checked-in sample fixture
- Keeps only tickets whose subject contains uppercase `DDP`

### Fetch + Enrich

- Fetches live tickets
- Applies the same `DDP` filter
- Runs AD enrichment automatically
- If AD enrichment fails, tickets are still shown and the UI displays a warning

### Enrich Current Tickets

- Enriches the currently loaded tickets
- Useful when you want to fetch first and enrich later

## CLI fetch helper

Run:

```bash
pnpm fetch:tickets -- --count 5
```

This uses the same live session refresh path as the UI fetch flow.

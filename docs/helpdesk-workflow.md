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

### Processed DDP View

- Available after `Fetch Live`, `Load Sample`, or `Fetch + Enrich`
- AD identity fields come from LDAP enrichment on the requester
- `NB Hostname` / `VM Hostname` in the ticket description are parsed when present
- When the description has no VM hostname, the app looks up the **applicant's direct manager** (`managerAccount` from LDAP) in Zentera exports under `Mapping ADGroup、Zentera/` (`User_Roles_*.csv` → `Server_Profiles_*.csv`)
- If multiple VMs match, the first hostname in alphabetical order is shown and `ambiguous-vm-hostname` is flagged
- Without LDAP enrich, **AD Account** can be parsed from the ticket description (`Account name` / 帳號 labels); the Helpdesk **requester** field is only used when it matches the applicant in the description (submitter vs applicant)
- Processed **abnormal flags** and Excel **異常** column use the same rules (including `missing-vm-hostname` and `ambiguous-vm-hostname`)
- Highlights newly observed tickets and abnormal rows
- Use the `Raw Tickets` / `Processed DDP View` toggle in the table area

### Export Excel

- Available when tickets are loaded (same data as Processed DDP View)
- Produces `ddp_ticket_maintain.xlsx` with sheets **待處理** (Open/Onhold), **Closed**, and **All**
- Column order and styling follow `IT工單(不可用，僅供參考)/process_ddp_tickets.py`
- Abnormal column matches Processed `abnormalFlags` (including Zentera `missing-vm-hostname` / `ambiguous-vm-hostname`)
- **Role** / **Application** / **User Roles** columns: from Zentera CSV indexes when VM and manager enrich are available; Role may fall back to a two-letter code derived from the VM hostname (notebook rule)
- NAS, Template Name, Location, NEW VM remain empty unless a future data source is added
- Server route: `POST /api/tickets/export-excel`

```bash
pnpm export:excel
pnpm export:excel -- --output=./ddp_ticket_maintain.xlsx
```

### One-shot workflow (CLI)

Fetch live tickets with AD enrich, then write Excel (no UI):

```bash
pnpm workflow:ddp -- --count=25 --output=./ddp_ticket_maintain.xlsx
```

Requires a valid Helpdesk session (`pnpm auth:login`) and LDAP reachability for enrich.

### Windows Task Scheduler (batch)

Run the DDP workflow without the UI on a schedule:

```powershell
# From repo root (adjust paths for your machine)
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\run-ddp-workflow.ps1 -Count 25
```

Logs are written under `logs/ddp-workflow-*.log`. In Task Scheduler, set **Start in** to the repo root and use the same command; run under a domain account with Helpdesk session + LDAP access.

### SharePoint download (optional)

Legacy Python `fetch_sharepoint_file.py` is ported to TypeScript. Copy `config/sharepoint.example.yaml` to `config/sharepoint.yaml`. First run opens a browser for manual login and saves `sp_state.json`.

```bash
pnpm sharepoint:fetch
pnpm sharepoint:fetch -- --config=config/sharepoint.yaml
```

Progress and remaining work: [`docs/PROGRESS.md`](PROGRESS.md).

## CLI fetch helper

Run:

```bash
pnpm fetch:tickets -- --count 5
```

This uses the same live session refresh path as the UI fetch flow.

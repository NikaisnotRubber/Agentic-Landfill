# Helpdesk Workflow

## Local files

- `config/helpdesk-auth.yaml`
- `IT撌亙(銝?剁?????/delta_sso_state.json`

## Bootstrap login

Run:

```bash
pnpm auth:login -- --config config/helpdesk-auth.yaml
```

This writes a verified Playwright storage-state file to the configured `stateFile`.

### Login selector profile

`pnpm auth:login` detects the current runtime before interacting with the Helpdesk login page:

- Windows (`process.platform === "win32"`): tries the native ServiceDesk Plus controls first: `#username`, `#password`, `#domain_select` / `select[name="domain"]`, and `#loginSDPage` / `button[name="loginButton"]`.
- WSL/Linux: tries Playwright role locators first, then falls back to the same native selectors.

This keeps the login automation compatible with the Windows DOM observed by Playwright while preserving the WSL/Linux role-based path.

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

### VM Master sync from Helpdesk

- `pnpm db:migrate` applies VM Master schema updates, including `vm_machines.max_online_users` for per-VM online capacity limits.
- LDAP attributes are normalized at the AD parser boundary before VM Master rows are written.
- AD `cn` values in the format `{English name} {Chinese name}` are split for VM Master output.
- `CHN_NAME` stores only the Chinese name; if no Chinese name exists, it falls back to the English name.
- `REPORT_TO` stores the manager account when LDAP resolves it; fallback display-name parsing keeps only the English portion.

### VM Master Preview manual edit

- The VM Master Preview page is query-first: `GET /api/vm-master/preview` only reads the SQLite preview projection.
- Use **Edit** to create a local draft of the current preview rows.
- Editable fields include user profile fields, group/role fields, `VM_NAME`, and `MAX_ONLINE_USERS`; `AD_NAME` is kept read-only for this iteration.
- **Cancel** discards the local draft.
- **Publish** sends dirty rows to `POST /api/vm-master/commands/manual-edit`.
- The command endpoint writes `vm_master_manual_edit_commands` and `vm_master_manual_edit_changes` in the same SQLite transaction as the `vm_users`, `vm_machines`, and `vm_user_vm_assignments` updates.
- `published_at` in `vm_master_manual_edit_commands` is reserved for a future outbox worker or message queue bridge; it remains empty in this iteration.
- After publish succeeds, the UI reloads `GET /api/vm-master/preview` so the table reflects the query projection, not local optimistic state.
### Processed DDP View

- Available after `Fetch Live`, `Load Sample`, or `Fetch + Enrich`
- AD identity fields come from LDAP enrichment on the requester
- `NB Hostname` / `VM Hostname` in the ticket description are parsed when present
- When the description has no VM hostname, the app looks up the **applicant's direct manager** (`managerAccount` from LDAP) in Zentera exports under `Mapping ADGroup?entera/` (`User_Roles_*.csv` ??`Server_Profiles_*.csv`)
- If multiple VMs match, the first hostname in alphabetical order is shown and `ambiguous-vm-hostname` is flagged
- Without LDAP enrich, **AD Account** can be parsed from the ticket description (`Account name` / 撣唾? labels); the Helpdesk **requester** field is only used when it matches the applicant in the description (submitter vs applicant)
- Processed **abnormal flags** and Excel **?啣虜** column use the same rules (including `missing-vm-hostname` and `ambiguous-vm-hostname`)
- Highlights newly observed tickets and abnormal rows
- Use the `Raw Tickets` / `Processed DDP View` toggle in the table area

### Export Excel

- Available when tickets are loaded (same data as Processed DDP View)
- Produces `ddp_ticket_maintain.xlsx` with sheets **敺???* (Open/Onhold), **Closed**, and **All**
- Column order and styling follow `IT撌亙(銝?剁?????/process_ddp_tickets.py`
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

### Platform mapping API (Track B)

Requires a published batch in `data/platform.db` (run `pnpm plat:run` first).

```bash
curl http://localhost:5173/api/platform/mapping/published
curl "http://localhost:5173/api/platform/mapping/rows?adAccount=LEO.ZOU&limit=10"
curl http://localhost:5173/api/platform/mapping/batches
```

Set `USE_PLATFORM_MAPPING_DB=1` (see `config/platform.example.env`) to prefer published `mapping_row` over Zentera CSV indexes during Processed enrich.

Progress and remaining work: [`docs/PROGRESS.md`](PROGRESS.md).

## CLI fetch helper

Run:

```bash
pnpm fetch:tickets -- --count 5
```

This uses the same live session refresh path as the UI fetch flow.

# Helpdesk VM Sync Lifecycle Test Design

> Date: 2026-06-18  
> Status: Draft for review  
> Scope: configurable Vitest coverage for Helpdesk VM sync lookup, DB insert, and same-user update

## Goal

Add one focused lifecycle test folder for `syncHelpdeskVmMaster` that can verify:

1. User lookup and manager resolution for a Helpdesk ticket user.
2. First sync writes the user and copied manager VM assignments into SQLite.
3. A second sync for the same user updates user fields and replaces previous VM assignments.

The test must be driven by a YAML config so specific flow nodes and test data can be enabled or disabled without editing test code.

## Non-Goals

- Do not add production code unless the lifecycle test exposes a real sync bug.
- Do not build a custom test runner or CLI.
- Do not require live AD for the default test run.
- Do not exercise real Helpdesk login/session. Tickets are still mocked at the fetch boundary.

## Folder Layout

```text
tests/helpdesk-vm-sync-lifecycle/
  config.yaml
  lifecycle.test.ts
```

`lifecycle.test.ts` is the only test file. It reads `config.yaml`, opens a temporary SQLite DB, mocks Helpdesk ticket fetches, and calls the real `syncHelpdeskVmMaster`.

## YAML Config

```yaml
nodes:
  liveAdLookup: true
  initialSync: true
  updateSync: true

database:
  path: data/vm-master.sqlite
  resetBeforeRun: false
  keepAfterRun: true

user:
  adAccount: SUNGCHAO.SC.YU
  displayName: SUNGCHAO.SC.YU
  mail: SUNGCHAO.SC.YU@cyntec.com
  department: Software/Firmware Engineering HC Section
  manager: ALEX.MX.CHEN
  managerDn: "CN=ALEX.MX.CHEN,OU=RD1,OU=Users,OU=TWCYN,OU=TW,OU=Delta,DC=delta,DC=corp"
  employeeId: "763002"
  bg: CPBG
  bu: "CP R&D"

manager:
  adName: ALEX.MX.CHEN
  chnName: ALEX.MX.CHEN
  emailAddress: ""
  bg: CPBG
  bu: "CP R&D"
  vmAssignments:
    - vmName: TWPJDDP01
      groupName: DDP_USERS
      zenteraRole: DDP_USER

update:
  user:
    mail: sungchao.updated@example.test
    bg: CPBG
    bu: "CP R&D Updated"
  manager:
    vmAssignments:
      - vmName: TWPJDDP02
        groupName: DDP_POWER_USERS
        zenteraRole: DDP_POWER
```

## Flow Nodes

### `liveAdLookup`

When `false`, the test uses the `user` values in YAML through a mocked `AdLookupClient`.

When `true`, the test calls the app's real `createAdLookupClient()` for `user.adAccount`. The resolved AD data replaces the YAML user fields for that run. The manager account is resolved with the existing app behavior:

- Prefer `lookupManagerAccount(user.managerDn)` when it returns an account.
- Otherwise fall back to `resolveAdEnglishName(user.manager)`.

The test should allow the existing `manager-account-fallback` warning when simple bind credentials are absent.

### `initialSync`

The test seeds the manager row and manager VM assignments from YAML, then calls `syncHelpdeskVmMaster` with a mocked Helpdesk ticket:

```text
short_description: "AD Account: <user.adAccount>"
```

Assertions:

- Result is `ok: true`.
- Summary reports one fetched, parsed, LDAP-enriched, user-upserted, manager-matched, and assignment-inserted record.
- `vm_users` contains the synced user.
- `vm_user_vm_assignments` contains the copied manager assignment for the synced user.
- `REPORT_TO` equals the resolved manager account, not a hardcoded test-only account.

### `updateSync`

The test runs a second sync against the same temporary DB and same Helpdesk user. It uses the YAML `update.user` fields in the mocked lookup response and replaces the seeded manager assignments with `update.manager.vmAssignments` before the second sync.

Assertions:

- The same `vm_users.ad_name` row is updated, not duplicated.
- Updated fields such as `email_address`, `bg`, `bu`, `bu_curr`, and `bg_curr` match repository behavior.
- Old user VM assignments are removed.
- New user VM assignments are inserted.

## DB Verification

The test should query SQLite directly:

- `vm_users` by `ad_name`.
- `vm_user_vm_assignments` by `ad_name`, ordered by `vm_name`.

This verifies actual DB writes instead of only checking the sync summary.

When `database.keepAfterRun` is `true`, the SQLite file remains after the test so operators can inspect the rows manually. When `database.path` points at the service preview DB (`data/vm-master.sqlite`), keep `database.resetBeforeRun: false` so the test does not delete the app database before opening it.

## Error Handling

- If all nodes are disabled, the test should fail fast with a clear config error.
- If `liveAdLookup` is enabled and AD lookup cannot find the user, the test should fail with the account name in the message.
- The default config must not depend on live AD, so normal `pnpm vitest run` remains stable.

## Verification Command

```bash
pnpm vitest run tests/helpdesk-vm-sync-lifecycle/lifecycle.test.ts
```

## Known Trade-Offs

- YAML parsing uses the already-installed `yaml` package.
- This is an integration-style test, so it will be slower than pure unit tests.
- The test folder owns its own config and temp DB cleanup to avoid touching real app data.

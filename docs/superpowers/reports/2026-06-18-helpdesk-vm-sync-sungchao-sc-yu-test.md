# Helpdesk VM Sync Mock Test: SUNGCHAO.SC.YU

> Date: 2026-06-18  
> Scope: `syncHelpdeskVmMaster` live-AD regression test  
> Test: `tests/helpdeskVmSync.test.ts`

## Summary

Updated the `SUNGCHAO.SC.YU` Helpdesk VM sync test to use the app's real AD lookup path instead of a hardcoded manager mock.

The test simulates:

- Helpdesk returns one DDP ticket with `short_description: "AD Account: SUNGCHAO.SC.YU"`.
- `createAdLookupClient()` resolves `SUNGCHAO.SC.YU`.
- The resolved AD manager is `ALEX.MX.CHEN` from `manager: "ALEX.MX.CHEN 陳銘信"`.
- VM Master is seeded with the resolved manager, not a fake fixed manager.
- Sync upserts `SUNGCHAO.SC.YU` and copies the manager VM assignment.

## TDD Observation

The corrected test produced useful RED states:

- First RED: live AD lookup exceeded Vitest's default 5s timeout.
- Second RED: sync returned `manager-account-fallback`, because `lookupManagerAccount()` returned null without simple bind credentials.

No production code was changed. The test now documents the current live-AD behavior: manager account falls back to parsing `user.manager`, resulting in `REPORT_TO=ALEX.MX.CHEN`.

## Verification

Command:

```bash
pnpm vitest run tests/helpdeskVmSync.test.ts
```

Result:

```text
Test Files  1 passed (1)
Tests       2 passed (2)
```

## Existing Issues

| Issue | Evidence | Direction |
| --- | --- | --- |
| Live AD test is slower than unit tests | The case needs a 60s Vitest timeout | Keep the timeout local to this test; split live AD tests later if CI needs fast-only runs |
| Manager account lookup falls back | `manager-account-fallback` warning with `REPORT_TO=ALEX.MX.CHEN` | Configure simple bind credentials if exact manager DN lookup is required; fallback is acceptable for current sync |
| Node SQLite warning appears during test run | `ExperimentalWarning: SQLite is an experimental feature` | Accept for now, or isolate SQLite behind a test-safe DB adapter if CI treats warnings as failures |

## Covered Behavior

- Ticket parser reads `AD Account: SUNGCHAO.SC.YU`.
- Live AD enrichment succeeds through `createAdLookupClient()`.
- Manager resolution uses `ALEX.MX.CHEN`, not `LEO.ZOU`.
- Existing manager VM assignment is copied to `SUNGCHAO.SC.YU`.
- Sync summary reports one fetched, parsed, enriched, upserted, and inserted assignment.

## Not Covered

- Live Helpdesk login/session.
- Missing manager, missing manager VM assignment, duplicate tickets, and fetch failures.
- Localized Helpdesk description labels beyond the stable English `AD Account:` form.

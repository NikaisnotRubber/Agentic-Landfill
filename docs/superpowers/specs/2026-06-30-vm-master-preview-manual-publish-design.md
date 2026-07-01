# VM Master Preview Manual Edit CQRS Design

## Goal

Allow operators to edit selected VM Master Preview fields in the browser and publish them through a command-side workflow that keeps preview querying separate from database mutation.

## Scope

This iteration edits existing preview rows only. It does not add rows, delete rows, add approval workflow, start a background worker, or introduce a message queue.

Editable fields:

- `chnName`
- `emailAddress`
- `bg`
- `bu`
- `userRole`
- `userDept`
- `reportTo`
- `buCurr`
- `bgCurr`
- `groupName`
- `vmName`
- `maxOnlineUsers`
- `zenteraRole`

Identity key:

- Rows are identified by the original `adName` + original `vmName`.
- `adName` is not editable in this iteration.

## CQRS Architecture

Query side:

- `GET /api/vm-master/preview`
- Reads only from the `vm_master_preview_by_bg` projection.
- Does not accept writes and does not know about draft state.

Command side:

- `POST /api/vm-master/commands/manual-edit`
- Accepts dirty row changes from the UI draft.
- Validates payload shape and editable-field allowlist.
- Writes a transactional command/outbox record and row-level before/after audit records.
- Updates the VM Master write model in the same SQLite transaction.

Write model:

- `vm_users`
- `vm_machines`
- `vm_user_vm_assignments`

The preview remains a derived read model. The command side never writes directly to `vm_master_preview_by_bg`.

## Command / Outbox Storage

Use DB tables, not local file logs, as the source of truth. The command record and write-model update must commit or roll back together.

`vm_master_manual_edit_commands` stores one publish command:

- `id`
- `command_type`
- `status`
- `payload_json`
- `changed_by`
- `created_at`
- `applied_at`
- `published_at`
- `error`

`published_at` stays `NULL` in this iteration. It is reserved for a future worker that publishes command records to a message queue if a second consumer appears.

`vm_master_manual_edit_changes` stores row-level audit:

- `id`
- `command_id`
- `original_ad_name`
- `original_vm_name`
- `before_json`
- `after_json`

Local log files may still be added later for operator troubleshooting, but they are not the business source of truth.

## API

`POST /api/vm-master/commands/manual-edit`

Request:

```json
{
  "changedBy": "operator",
  "changes": [
    {
      "originalAdName": "LEO.ZOU",
      "originalVmName": "TWPJDDP01",
      "row": {
        "adName": "LEO.ZOU",
        "chnName": "Leo Zou",
        "emailAddress": "leo.zou@example.test",
        "bg": "DBG",
        "bu": "DDP",
        "userRole": "USER",
        "userDept": "IT",
        "reportTo": "MANAGER.AD",
        "buCurr": "DDP",
        "bgCurr": "DBG",
        "groupName": "DDP_USERS",
        "vmName": "TWPJDDP02",
        "maxOnlineUsers": 20,
        "zenteraRole": "DDP_USER"
      }
    }
  ]
}
```

Success response:

```json
{ "ok": true, "commandId": "...", "updatedCount": 1 }
```

Validation failures return `{ "ok": false, "error": "..." }` with HTTP 400.

## UI Behavior

The page defaults to read-only. `Edit` creates a local draft from the latest preview. Editable detail cells become inputs. `Cancel` discards draft changes. `Publish` is disabled until at least one row is dirty. After successful command execution, the page reloads the query-side preview from the DB.

BG edits do not immediately regroup rows while editing. Regrouping happens after publish and reload, so the UI does not pretend the read projection has already changed.

## Testing

Backend tests cover:

- command execution updates write-model tables;
- command and row audit records are written in the same transaction;
- VM rename behavior keeps assignments consistent and removes an unused old VM record;
- malformed command payloads are rejected by the command route.

Frontend verification uses TypeScript/Vite build for this iteration. Browser automation can be added if the workflow grows to row creation, deletion, or conflict resolution.
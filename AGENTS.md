# Workspace Instructions

## Package manager

- Prefer `pnpm` as the package manager for all Node.js work in this repository.
- Do not use `npm` or `bun` unless the user explicitly asks for them or a task strictly requires them.
- When adding or updating scripts, commands, or docs for package management, write them using `pnpm`.

## Progress and backlog (required for agents)

**Single source of truth:** [`docs/PROGRESS.md`](docs/PROGRESS.md)

After each iteration that ships user-visible or architectural work:

1. Update **`docs/PROGRESS.md`**:
   - Move completed items to ✅ (or 🟡 if partial).
   - Add a row under **迭代紀錄** with date, iteration name, and deliverables.
   - Refresh **最後更新** at the top.
   - Adjust **建議下一步** if priorities changed.
2. If behavior changed for operators, update **`docs/helpdesk-workflow.md`** (commands, buttons, env vars).
3. Do **not** duplicate long backlog lists in `AGENTS.md`—link to `docs/PROGRESS.md` instead.

Status legend used in `PROGRESS.md`: ✅ done · 🟡 partial · ⬜ not started · 🔮 long-term platform track.

## Reference specs (read before large changes)

| Area | Document |
|------|----------|
| Helpdesk / DDP tickets | `docs/superpowers/specs/2026-05-29-helpdesk-processed-ddp-view-design.md` |
| **Phase 2 開發分支** | `feat/phase-2-vm-identity-excel`（見 `docs/superpowers/plans/2026-06-02-branch-workflow.md`） |
| **Phase 2 執行 To-Do（勾選）** | `docs/superpowers/plans/2026-06-02-phase-2-todo.md` |
| 待辦 ID / 全階段 Roadmap | `docs/superpowers/specs/2026-06-02-helpdesk-backlog.md`, `docs/superpowers/plans/2026-06-02-helpdesk-development-roadmap.md` |
| Excel export (legacy) | `IT工單(不可用，僅供參考)/process_ddp_tickets.py` |
| AD + Zentera platform | `Mapping ADGroup、Zentera/docs/platform_requirements_draft.md` |
| Platform DB goal | `Mapping ADGroup、Zentera/docs/to-do/0602.md` |

## Auto 模式：標示目前模型

當使用者選擇 **Auto** 作為模型時，依工作階段簡短標示**實際執行的模型**（例如：「目前正在分析文件…（**Composer 2.5**）」）。細則見 [`.cursor/rules/auto-model-disclosure.mdc`](.cursor/rules/auto-model-disclosure.mdc)。

## Git（Phase 2）

- Phase 2 實作只在 **`feat/phase-2-vm-identity-excel`** 進行。
- **未經使用者確認功能前，不要 merge 到 `master`**，也不要 force-push 主線。

## Secrets

- Never commit real credentials. Use `config/helpdesk-auth.example.yaml`; local `config/helpdesk-auth.yaml` stays untracked.

# Git 分支工作流程 — Phase 2 迭代

> **最後更新**：2026-06-02  
> **執行 To-Do**：[`2026-06-02-phase-2-todo.md`](2026-06-02-phase-2-todo.md)

## 分支一覽

| 分支 | 用途 | 合併目標 |
|------|------|----------|
| `master`（或 `main`） | **主線**；僅在使用者確認功能後合併 | — |
| `feat/helpdesk-processed-ddp-view` | Phase 1 Processed View 已推送的遠端功能分支 | 可先合併至 `master`，或作為 Phase 2 的歷史基底 |
| **`feat/phase-2-vm-identity-excel`** | **目前開發分支**：Phase 2A（VM／身分／異常）+ 2B（Excel Role／測試），以及工作區內 Phase 1 殘留提交 | `master`（**須經使用者確認**） |

## 規則

1. **Phase 2 程式與 spec 變更只在此分支進行**（`feat/phase-2-vm-identity-excel`）。
2. **禁止**在未經使用者明確同意前，將本分支 merge / push 覆寫 `master`。
3. 每完成 Phase 2A 或 2B 子階段，在分支上 commit；更新 [`docs/PROGRESS.md`](../../PROGRESS.md) 與 phase-2-todo 勾選。
4. 合併主線前檢查清單：
   - [ ] `pnpm test` 通過
   - [ ] `pnpm run build` 通過
   - [ ] 使用者手動驗證：Fetch + Enrich → Processed → Export Excel
   - [ ] 未提交 `config/helpdesk-auth.yaml`、Excel 暫存 `~$*.xlsx` 等敏感／垃圾檔

## 常用指令

```bash
# 確認目前在 Phase 2 分支
git branch --show-current
# 預期：feat/phase-2-vm-identity-excel

# 開發中提交（範例）
git add server/ tests/ docs/
git status
git commit -m "feat(phase-2a): ..."

# 首次推送遠端
git push -u origin feat/phase-2-vm-identity-excel

# 使用者確認後合併主線（由使用者或維運執行）
git checkout master
git pull origin master
git merge feat/phase-2-vm-identity-excel
git push origin master
```

## 工作區現況說明（2026-06-02）

自 `feat/helpdesk-processed-ddp-view` 建立本分支時，工作區含 **尚未 commit** 的變更，包括：

- Phase 1 補齊（Excel 匯出、Zentera、parseAdName、manager 等）
- Phase 2 規劃文件（`docs/superpowers/*`、`docs/PROGRESS.md`）

**建議第一次提交**（可拆兩個 commit，便於 review）：

1. `chore: phase 1 completion — excel export, zentera vm, identity parsing`
2. `docs: phase 2 backlog, roadmap, branch workflow`

之後 Phase 2A/2B 實作各自獨立 commit。

## 與 PR 的對應

若使用 GitHub PR：以 `feat/phase-2-vm-identity-excel` → `master` 開 PR，標題註明 **Phase 2A/2B**，描述連結 phase-2-todo 與 vm-lookup spec；**勿**在 PR 說明中勾選「已合併」直到使用者驗收完成。

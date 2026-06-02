# Track B — 映射 DB 與匯出契約（開發計劃）

> **For agentic workers:** 依 **B0 → B6** 順序實作；每完成子任務更新 checkbox 與 [`docs/PROGRESS.md`](../../PROGRESS.md)。  
> **Spec：** [`specs/2026-06-03-platform-mapping-db-export.md`](../specs/2026-06-03-platform-mapping-db-export.md)  
> **Contract:** [`fixtures/mapping-export-schema.json`](../fixtures/mapping-export-schema.json)  
> **Branch:** `feat/platform-mapping-db-export`（自 `master`）

## 目標（本迭代）

1. DB **`mapping_row`** 與 Excel **`ad_user_vm_mapping.xlsx`** 交付列 1:1 語意對齊。  
2. **`mapping-export-schema.json`** 驅動匯出細粒度對齊（欄位名、型別、transform）。  
3. Pipeline 對齊 `ddp_analysis.ipynb` 最終 join（可選：與舊 xlsx 抽樣 diff）。  
4. **不阻塞** Helpdesk Web；B6 才接工單匯出共用契約。

## 架構（建議目錄）

```text
platform/
  schema/                 # SQL migrations
  import/                 # raw + normalized loaders
  mapping/                # materialize mapping_row
  export/                 # serialize + xlsx/csv
  contract/               # load mapping-export-schema.json
tests/platform/
  fixtures/               # minimal CSV/xlsx slices
  mappingExportSchema.test.ts
  mappingExportSerialize.test.ts
  mappingPipeline.golden.test.ts   # optional, needs sample files
```

## 時程概覽

| 階段 | 名稱 | 依賴 | 建議 |
|------|------|------|------|
| **B0** | 契約與 serializer | — | 1–2 天 |
| **B1** | DB migration | B0 | 1–2 天 |
| **B2** | 匯入 raw/normalized | B1 | 3–5 天 |
| **B3** | 產生 mapping_row | B2 | 3–5 天 |
| **B4** | 匯出 xlsx/csv | B0,B3 | 1–2 天 |
| **B5** | Published batch API | B3 | 2–3 天 |
| **B6** | Helpdesk 契約合一 | B4,B5 + Track A | 2–3 天 |

---

## B0 — 匯出契約（REQ-PLAT-003）

- [x] **B0.1** 將 [`mapping-export-schema.json`](../fixtures/mapping-export-schema.json) 定為唯一契約（spec 已建立）。
- [x] **B0.2** `platform/contract/loadMappingExportSchema.ts` — 載入並驗證 JSON（欄位唯一、順序穩定）。
- [x] **B0.3** `platform/export/serializeMappingRow.ts` — `MappingRow` → `string[]`（19 欄），套用 `transform`。
- [x] **B0.4** `platform/export/types.ts` — `MappingRow` 與 JSON `dbColumn` 同步。
- [x] **B0.5** `tests/platform/mappingExportSerialize.test.ts` — transform / Role 覆寫案例。
- [x] **B0.6** `tests/platform/mappingExportSchema.test.ts` — 與 spec §3.2 欄位數、表頭字面一致。
- [x] **B0.7** 文件：在 [`platform_requirements_draft.md`](../../../Mapping%20ADGroup%E3%80%81Zentera/docs/platform_requirements_draft.md) 頂部加連結至本 spec。

**驗收：** `pnpm test` 含 B0 測試全綠；無 DB 亦可跑。

---

## B1 — 資料庫（REQ-PLAT-001）

- [x] **B1.1** 決策 **D-DB-01**：`platform/` 於 repo 根。
- [x] **B1.2** `platform/db/schema.ts` — `batches`, `batch_files`。
- [x] **B1.3** `raw_*` 表（AD members、users、role_user、servers）。
- [x] **B1.4** `mapping_row` — 欄位名 = JSON `dbColumn` + internal。
- [x] **B1.5** `platform/db/database.ts` — Node `node:sqlite` + migrate。
- [ ] **B1.6** 本機 dev：`.env.example` 增加 `DATABASE_URL`；文件說明 PG vs SQLite。
- [x] **B1.7** 測試：`tests/platform/platformPipeline.test.ts` 端到端建表讀寫。

**驗收：** migration 可重複執行；欄位與契約 JSON 100% 對照。

---

## B2 — 匯入與正規化（REQ-PLAT-002 前半）

- [x] **B2.1** `platform/import/parseAdGroupsXlsx.ts`。
- [x] **B2.2** 重用 `server/zentera/parseCsv` + `importBatchFiles.ts`。
- [ ] **B2.3** `validateBatchFiles.ts` — 必要欄位驗證（待補）。
- [x] **B2.4** `platform/import/expandRoleUsers.ts`。
- [x] **B2.5** `platform/import/normalizeAccount.ts`。
- [ ] **B2.6** `repairUserNames` heuristic（待補）。
- [x] **B2.7** `tests/platform/platformPipeline.test.ts`。
- [x] **B2.8** 合併於 `pnpm plat:run`。

**驗收：** 固定 fixture 匯入後，normalized 列數與 notebook 文件記載同數量級（可標註 expected counts）。

---

## B3 — 映射物化（REQ-PLAT-002 後半）

- [x] **B3.1** `platform/mapping/materializeMappingRows.ts`（INNER JOIN users、LEFT JOIN role/server）。
- [x] **B3.2** `platform/mapping/inferRoleFromHostname.ts`。
- [x] **B3.3** `platform/mapping/excludedAdGroups.ts`。
- [x] **B3.4** 寫入 `mapping_row` + published/archived。
- [ ] **B3.5** `mapping_exceptions` 表（待補）。
- [x] **B3.6** 合併於 `pnpm plat:run`。
- [ ] **B3.7** 與既有 xlsx 抽樣 diff（待補）。

**驗收：** 同一批來源檔重跑兩次，`mapping_row` checksum 一致；列數邏輯與 review 一致（join 膨脹非 bug）。

---

## B4 — 匯出（REQ-PLAT-004）

- [x] **B4.1** `platform/export/exportMappingXlsx.ts`。
- [ ] **B4.2** `exportMappingCsv.ts`（待補）。
- [x] **B4.3** `pnpm plat:run -- --data-dir=... --output=...`。
- [ ] **B4.4** Golden row JSON（待補）。
- [x] **B4.5** `package.json`：`plat:run`。

**驗收：** 匯出檔欄位順序、表頭字面與契約 JSON 完全一致。

---

## B5 — Published batch 讀取（REQ-PLAT-005）

- [ ] **B5.1** `GET /api/platform/mapping/published` — 元資料（batch_id, row_count, exported_at）。
- [ ] **B5.2** `GET /api/platform/mapping/rows?adAccount=&limit=` — 分頁查詢（供 UI / enrich）。
- [ ] **B5.3** 依 **D-DB-02** 保留歷史批次列表 API（可選 V1.1）。

**驗收：** 無 UI 亦可 curl 取得 published 列；與 DB 一致。

---

## B6 — Helpdesk 匯出契約合一（REQ-PLAT-006）

- [ ] **B6.1** 決策 **D-TICKET-01**（Host IP 是否進工單表）。
- [ ] **B6.2** 重構 `server/excel/buildDdpExcelRows.ts` — 映射欄從 `serializeMappingRow` 或共用 `mappingFieldId` map 取值。
- [ ] **B6.3** `ProcessedDdpRow` / enrich：可選從 published `mapping_row` by `ad_account` 補 `role`, `application`, `user_roles`（取代僅 CSV 索引）。
- [ ] **B6.4** 更新 `export-golden-columns.json` 與契約 `inTicketWorkbook` 對齊。
- [ ] **B6.5** 文件更新 [`helpdesk-workflow.md`](../../helpdesk-workflow.md)。

**驗收：** `pnpm test` 工單匯出測試仍綠；映射欄與平台匯出同一 transform。

---

## 與其他軌道關係

| 軌道 | 關係 |
|------|------|
| **Track A** Phase 4 | SharePoint/排程可並行；不依賴 B0–B5 |
| **平台 UI** | 可讀 B5 API；UI 優化在 B5 之後 |
| **0602.md** | 指向本 plan + spec |

## CI

- [ ] **B-CI-1** 將 `tests/platform/**` 納入現有 `pnpm test`（已含於 vitest）。
- [ ] **B-CI-2** 可選：大檔匯入測試標 `@slow`，預設 CI 跳過。

## 完成定義（本 branch 合併 master 前）

1. B0–B4 完成且測試綠燈。  
2. 至少一次本機端到端：`plat:import` → `plat:map` → `plat:export`。  
3. `docs/PROGRESS.md` Track B 區塊更新；backlog REQ-PLAT-001～004 標 🟡/✅。  
4. 使用者確認匯出 xlsx 與預期欄位／樣本資料一致。

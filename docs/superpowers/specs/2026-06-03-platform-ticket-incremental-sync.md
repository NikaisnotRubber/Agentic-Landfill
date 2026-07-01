# Platform — 工單驅動增量更新總表（SQLite）

> **Status:** In progress  
> **Branch:** `feat/platform-mapping-db-export`  
> **Parent:** [`2026-06-03-platform-mapping-db-export.md`](2026-06-03-platform-mapping-db-export.md)  
> **DB：** **SQLite only**（`node:sqlite` + `data/platform.db`）

## 1. 業務一句話

**依 Helpdesk 報案（DDP 工單）處理結果，增量 upsert 映射總表（`mapping_row`）；週期性仍以 AD / Zentera 檔案批次刷新基底，匯出時契約不變。**

## 2. 為何 SQLite

| 考量 | 決策 |
|------|------|
| 業務複雜度 | 單機、單檔、無多租戶 → 不需 PostgreSQL |
| Excel 匯入匯出 | 單檔 DB + 契約 serializer，與 xlsx 欄位 1:1 |
| 部署 | 與現有 Vite / CLI 同進程，`DATABASE_URL=file:./data/platform.db` |
| 參考 | Node.js [`node:sqlite` `DatabaseSync`](https://nodejs.org/api/sqlite.html)（Context7: prepared statements + transaction） |

## 3. 兩種資料來源

| 來源 | `source_kind` | `batch_id` | 觸發 |
|------|----------------|------------|------|
| AD + Zentera 檔案 | `batch` | 匯入批次 UUID | `pnpm plat:run` |
| Helpdesk 工單 | `ticket` | 固定 `live-ticket-sync` | Fetch + Enrich / Processed |

## 4. Upsert 鍵（工單）

同一申請人、同一組 VM/NB 視為一列：

`(ad_account, vm_hostname, nb_hostname)` **且** `source_kind = 'ticket'`

SQLite partial unique index：

```sql
CREATE UNIQUE INDEX ... ON mapping_row(ad_account, vm_hostname, nb_hostname)
WHERE source_kind = 'ticket';
```

衝突時更新：姓名、mail、BU、role、application、user_roles、nb/vm、`ticket_id`、`updated_at`；**不刪除** `source_kind = 'batch'` 列。

實作：`find` + `UPDATE` / `INSERT`（Node `node:sqlite` 對 partial unique index 的 `ON CONFLICT` 支援有限）；DB 仍保留 partial index 防重。

## 5. 整合點

- `attachProcessedPayload` 在 `processDdpTickets` 之後呼叫 `upsertMappingFromProcessedRows`。
- 開關：`PLATFORM_SYNC_TICKETS=1`（預設開啟）；`0` 則僅記憶體 Processed，不寫 DB。
- 與 `USE_PLATFORM_MAPPING_DB=1` 搭配：`lookupPublishedMappingRow` 先查 `source_kind=ticket`，再查 `batch`（同帳號 + VM hostname）。

## 6. API / 匯出

- 查詢 API：已發佈批次之 `mapping_row`（含 `live-ticket-sync`）。
- 匯出 xlsx/csv：全表或依 `batch_id`；契約仍為 19 欄。

## 7. 可觀測性（B7.6 / REQ-PLAT-009）

工單 upsert 完成後，`processedSummary.mappingSync` 提供批次摘要（`attempted` / `upserted` / `skipped` / `error`）。Helpdesk Web 與 API 契約須一致暴露；詳見專 spec：

**[`2026-06-03-platform-mapping-sync-observability.md`](2026-06-03-platform-mapping-sync-observability.md)**

## 8. 需求 ID

| ID | 說明 |
|----|------|
| **REQ-PLAT-007** | 工單 Processed → `mapping_row` upsert |
| **REQ-PLAT-008** | SQLite 為唯一正式選型（更新主 spec） |
| **REQ-PLAT-009** | `mappingSync` 可觀測性（UI + API 契約） |

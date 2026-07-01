# Platform — 工單→總表同步可觀測性（B7.6 / REQ-PLAT-009）

> **Status:** Approved for implementation  
> **Branch:** `feat/platform-mapping-db-export`（或自 `master` 切出後續分支）  
> **Parent spec:** [`2026-06-03-platform-ticket-incremental-sync.md`](2026-06-03-platform-ticket-incremental-sync.md)  
> **Dev plan:** [`plans/2026-06-03-platform-track-b-plan.md`](../plans/2026-06-03-platform-track-b-plan.md) §B7.6  
> **Depends on:** B7.1–B7.5（upsert 與 enrich 優先序已實作）

## 1. 背景與問題

B7.1–B7.5 已實作「工單 Processed → SQLite `mapping_row` 增量 upsert」，並在 enrich 時優先讀 ticket 列。此行為在 **`attachProcessedPayload`** 內**背景執行**，操作者若未手動開啟 `data/platform.db`，難以確認：

- 本次取票／enrich 是否已寫入總表；
- 寫入幾筆、略過幾筆；
- DB 或 migration 失敗時是否有錯誤（目前不應阻斷取票，但**必須可見**）。

後端已在 `processedSummary.mappingSync` 產生摘要；**B7.6 目標是讓 API 契約與 Helpdesk Web UI 一致暴露此摘要**，供維運與除錯。

## 2. 目標（一句話）

**每次 Fetch / Enrich 完成 Processed 後，使用者與整合方能在 UI 與 JSON 中看到 `mappingSync` 批次結果；失敗時以 warning 呈現，且不阻斷工單主流程。**

## 3. 非目標（本 spec 不包含）

| 項目 | 說明 |
|------|------|
| 映射總表 CRUD UI | 屬 Track B「平台 UI」大項，另立 spec |
| 逐筆 ticket → `mapping_row.id` 對照 | 需擴充 upsert 回傳明細，列為 B7.6 進階／後續 |
| WebSocket 即時推送 | 不在 V1 |
| 修改 upsert 業務規則 | B7.6 僅可觀測性，不改 B7.4 邏輯 |

## 4. 資料契約

### 4.1 型別（後端已存在）

定義於 `server/ddp/types.ts`：

```typescript
export type MappingSyncSummary = {
  attempted: number;  // 本次 processedRows 參與同步的列數
  upserted: number;   // 成功 INSERT 或 UPDATE 的列數
  skipped: number;    // 略過（例如無 ad_account）
  error?: string;     // DB 開啟／migration／upsert 失敗訊息
};

export type ProcessedDdpSummary = {
  totalRows: number;
  abnormalRowCount: number;
  newTicketCount: number;
  trackerWarning?: string;
  latestSeenId?: string;
  previousSeenId?: string;
  mappingSync?: MappingSyncSummary;  // B7.6 暴露重點
};
```

### 4.2 出現時機

| 條件 | `mappingSync` |
|------|----------------|
| `PLATFORM_SYNC_TICKETS=1`（或未設，預設開）且 `processedRows.length > 0` | 有；成功時含 `attempted/upserted/skipped`；失敗時含 `error` |
| `PLATFORM_SYNC_TICKETS=0` | **無**（不寫 DB，不產生摘要） |
| `processedRows` 為空 | **無** |

### 4.3 API 承載位置

Helpdesk 取票／enrich 成功回應（`TicketFetchSuccess`）：

```json
{
  "ok": true,
  "source": "live",
  "count": 10,
  "tickets": [ "..." ],
  "processedRows": [ "..." ],
  "processedSummary": {
    "totalRows": 10,
    "newTicketCount": 2,
    "abnormalRowCount": 1,
    "mappingSync": {
      "attempted": 10,
      "upserted": 9,
      "skipped": 1
    }
  }
}
```

失敗範例（取票仍成功）：

```json
"mappingSync": {
  "attempted": 10,
  "upserted": 0,
  "skipped": 0,
  "error": "SQLITE_READONLY: attempt to write a readonly database"
}
```

**觸發路徑（須在實作／測試中覆蓋）：**

- `fetchProcessAndEnrich` → `attachProcessedPayload`
- `enrichAdRoute` 內 reprocess 後（若仍走 `attachProcessedPayload` 或等價邏輯）

### 4.4 環境變數

| 變數 | 預設 | 說明 |
|------|------|------|
| `PLATFORM_SYNC_TICKETS` | `1` | `0` / `false` 關閉 upsert，不產生 `mappingSync` |
| `DATABASE_URL` | `file:./data/platform.db` | DB 路徑；失敗時寫入 `mappingSync.error` |

見 `config/platform.example.env`。

## 5. 功能需求

### F1 — 同步結果可讀

使用者應能解讀：

- **attempted**：本次處理列數；
- **upserted**：寫入總表列數；
- **skipped**：未寫入列數（目前主因：無 `ad_account`）。

### F2 — 與開關一致

`PLATFORM_SYNC_TICKETS=0` 時 API 不帶 `mappingSync`；UI 不顯示「已更新 N 列」（可選：顯示「工單→總表同步已關閉」需後端另帶 `mappingSyncEnabled: false` 旗標——**階段 2 可選**，階段 1 可省略）。

### F3 — 失敗可辨識

存在 `mappingSync.error` 時：

- UI 使用與 `adWarning` / `trackerWarning` 同級之 **warning status band**；
- 文案需含錯誤摘要，方便維運截圖。

### F4 — 前後端型別一致

`src/lib/types.ts` 的 `ProcessedDdpSummary` 須與 `server/ddp/types.ts` 對齊（含 `mappingSync`）。

### F5 — 不阻斷主流程

DB 同步失敗時：

- HTTP 取票／enrich 仍 `ok: true`（若工單本身成功）；
- 僅 `mappingSync.error` 標示失敗。

## 6. UI 需求（Helpdesk Web）

位置：`src/App.vue` **metrics-band**（與 AD Summary、New Tickets、Abnormal Rows 並列）。

| 元素 | 條件 | 建議呈現 |
|------|------|----------|
| 同步成功摘要 | `mappingSync` 且無 `error` | 標籤 `Mapping DB`；值 `已更新 {upserted} / {attempted} 列`（`skipped > 0` 時加 `略過 {skipped}`） |
| 同步失敗 | `mappingSync.error` | `<section class="status-band warning">`：`總表同步失敗：{error}` |
| 無摘要 | 無 `mappingSync` | 不顯示（階段 1） |

**參考既有 pattern：**

- `result?.adWarning` → warning band  
- `result?.processedSummary?.trackerWarning` → warning band  
- `result.adSummary` → metrics `wide` 列  

## 7. API 需求

### 7.1 階段 1（必做）

- 文件化：`processedSummary.mappingSync` 為公開契約（本 spec + plan B7.6）。
- 確認 enrich 路徑回傳與 fetch 路徑一致（整合測試）。

### 7.2 階段 2（可選）

新增維運端點（實作時寫入 `helpdesk-workflow.md`）：

```
GET /api/platform/mapping/sync-status
```

建議回應：

```json
{
  "ok": true,
  "batchId": "live-ticket-sync",
  "rowCount": 42,
  "lastUpdatedAt": "2026-06-03T12:00:00",
  "platformSyncTicketsEnabled": true
}
```

用途：不經 Helpdesk fetch 即可確認 ticket 增量批次狀態（curl／監控腳本）。

## 8. 與其他模組關係

```text
Fetch / Enrich
    → processDdpTickets
    → upsertMappingFromProcessedRows  →  SQLite mapping_row (live-ticket-sync)
    → processedSummary.mappingSync   →  B7.6 UI / API 文件
    → lookupPublishedMappingRow (B7.5)  ← enrich 讀取時 ticket 優先
```

- **B7.3** 負責寫入；**B7.5** 負責讀取優先序；**B7.6** 負責「有沒有寫成功」的可見性。
- **B5** `/api/platform/mapping/rows` 可查總表內容；B7.6 不替代 B5，僅補同步**結果摘要**。

## 9. 驗收標準

### 階段 1（B7.6 最小驗收）

- [ ] `src/lib/types.ts` 含 `MappingSyncSummary` 與 `processedSummary.mappingSync`。
- [ ] `App.vue` 顯示 upserted/attempted/skipped；`error` 顯示 warning band。
- [ ] 整合測試：mock 或 stub fetch 回傳含 `mappingSync`，assert 前端可解析（或 E2E 輕量測試）。
- [ ] `PLATFORM_SYNC_TICKETS=0` 時回應無 `mappingSync`（server 測試）。
- [ ] `pnpm test` 全綠。

### 階段 2（可選）

- [ ] `GET /api/platform/mapping/sync-status` 實作 + 測試 + workflow 文件。
- [ ] `listMappingBatches` 或 sync-status 標示 `live-ticket-sync` 為 ticket 增量批次。

## 10. 需求 ID

| ID | 說明 |
|----|------|
| **REQ-PLAT-009** | 工單→總表同步 `mappingSync` 可觀測性（UI + API 契約） |

## 11. 關鍵程式路徑

| 路徑 | 角色 |
|------|------|
| `server/fetchProcessAndEnrich.ts` | 產生 `mappingSync` |
| `server/ddp/types.ts` | 型別定義 |
| `platform/sync/upsertMappingFromProcessed.ts` | upsert 與 summary 計數 |
| `src/lib/types.ts` | 前端型別（待對齊） |
| `src/App.vue` | UI 展示（待實作） |

## 12. 文件維護

變更 `MappingSyncSummary` 欄位時順序：

1. 更新本 spec §4  
2. 更新 `server/ddp/types.ts` 與 `src/lib/types.ts`  
3. 更新 plan B7.6 checkbox  
4. 更新 [`2026-06-02-helpdesk-backlog.md`](2026-06-02-helpdesk-backlog.md) REQ-PLAT-009 狀態  

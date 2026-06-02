# Platform — 映射總表 DB 與匯出契約（Track B）

> **Status:** Approved for implementation  
> **Branch:** `feat/platform-mapping-db-export`  
> **Plan:** [`plans/2026-06-03-platform-track-b-plan.md`](../plans/2026-06-03-platform-track-b-plan.md)  
> **Machine-readable contract:** [`fixtures/mapping-export-schema.json`](../fixtures/mapping-export-schema.json)  
> **Related:** [`Mapping ADGroup、Zentera/docs/platform_requirements_draft.md`](../../../Mapping%20ADGroup%E3%80%81Zentera/docs/platform_requirements_draft.md), [`ddp_analysis_review.md`](../../../Mapping%20ADGroup%E3%80%81Zentera/docs/ddp_analysis_review.md)

## 1. 背景與目標

### 1.1 過去（Excel 總表時代）

- 以 **`ad_user_vm_mapping.xlsx`** 作為 AD × Zentera 映射的維護與交付表面。
- 產出依賴 **`ddp_analysis.ipynb`** + 本機 SQLite，規則隱含在 notebook，重跑與審計成本高。

### 1.2 現在（平台化方向）

| 目標 | 說明 |
|------|------|
| **DB 為 SoT** | 映射「交付列」存於 DB（`mapping_row`），語意與 Excel 總表列 **1:1 對齊**。 |
| **自動維護** | 匯入 AD Excel + 3× Zentera CSV → 正規化 → join → 寫入 `mapping_row`（對齊 notebook）。 |
| **可視化** | 平台 UI 查詢／預覽（另線；本 spec 定義資料與匯出契約）。 |
| **對外匯出** | xlsx/csv **細粒度**對齊欄位名、邏輯型別、空值與格式（**本 spec 核心**）。 |

### 1.3 與 Helpdesk 工單 Web 的邊界

- **工單 Web（Track A）**：取票、Processed View、`ddp_ticket_maintain.xlsx`。
- **映射平台（Track B）**：內容總表；**不把 tickets 匯入平台 V1**（沿用 `platform_requirements_draft.md` §13.1）。
- 工單匯出中的映射欄位，應與本 spec 的 **`mappingFieldId`** 共用契約（未來 **PLAT-006**）。

## 2. 核心原則

1. **DB 範式接近 Excel 交付列**，不要求整庫 3NF 都像 Excel；中間層可正規化，**published `mapping_row` 像 Excel**。
2. **匯出契約為單一真相來源**：`mapping-export-schema.json` 驅動 migration 欄位名、export serializer、golden 測試。
3. **所有對外儲存格為 string**（Excel 無強型別）；DB 可用 `text`；邏輯型別在契約層定義。
4. **空值統一**：匯出時 `NULL` → `""`（除非契約另訂）。
5. **列粒度**：一列 = notebook 最終 join 後的一列（**非一人一列**）；見 `ddp_analysis_review.md`。

## 3. 交付物：`mapping_row`

### 3.1 對齊的 Excel

| 檔案 | Sheet | 列粒度 |
|------|-------|--------|
| `ad_user_vm_mapping.xlsx` | 單一工作表（或等同） | `ad_members` LEFT JOIN `role_user` LEFT JOIN `servers` |

### 3.2 匯出欄位順序（19 欄）

順序與 [`mapping-export-schema.json`](../fixtures/mapping-export-schema.json) `columns[]` 一致：

`AD Account` → … → `Location`（含 **`Host IP`**，工單表目前無此欄，見決策 D-TICKET-01）。

### 3.3 內部欄位（不匯出）

`id`, `batch_id`, `role_inferred`, `role_override`, `source_*` 追溯鍵, `created_at` 等 — 見 JSON `internalColumns`。

### 3.4 V1 可編輯白名單（平台）

與 `platform_requirements_draft.md` §14.5 一致：

- `NEW VM`, `Template Name`, `Location`, `NAS Folder Name`
- 可選：`Role`（若啟用 override，須保留 `role_inferred`）

## 4. 資料分層

```text
batch_files (upload metadata)
    ↓
raw_*          ← 來源檔列級副本（唯讀）
    ↓
normalized_*   ← 帳號大寫、role_user 展開、姓名 heuristic
    ↓
mapping_row    ← 對外語意列（≈ Excel 一列）
    ↓
export         ← 依契約 serialize → xlsx / csv
```

**資料庫：** 正式環境 **PostgreSQL**；本機開發可用 SQLite，但 migration 須與 PG 相容。

## 5. 匯出契約（Export Contract）

### 5.1 欄位定義欄位

每欄在 JSON 契約中含：`excelHeader`, `dbColumn`, `logicalType`, `exportType`, `nullable`, `defaultWhenNull`, `transform`, `readonly`, `inTicketWorkbook`。

### 5.2 邏輯型別與 transform

| logicalType | 匯出規則摘要 |
|-------------|----------------|
| `ad_account` | trim + UPPERCASE |
| `email` | trim + lowercase |
| `hostname` | trim；NB 另 `maxLength: 11` |
| `role_list` | `", "` join |
| `ipv4` | trim，不驗證格式 V1 |
| `delivery_*` | trim，可人工覆寫 |

### 5.3 驗收

- [ ] `mapping-export-schema.json` 與 DB `mapping_row` 欄位一一對應（含內部欄）。
- [ ] `serializeMappingRow(row) → string[]` 長度 = 19，順序與 JSON 一致。
- [ ] 黃金測試：fixture 列 → xlsx 第一 data row 儲存格字串完全匹配。
- [ ] 與 notebook 樣本比對：≥50 列關鍵欄位一致（`AD Account`, `VM HostName`, `Group Name`, `Application`）。

### 5.4 工單工作簿（`ddp_ticket_maintain.xlsx`）

- 映射欄：契約中 `inTicketWorkbook: true` 的子集。
- 工單專屬欄：`ticketOnlyColumns`（Ticket ID、異常、工單狀態）。
- **D-TICKET-01**：是否在工單表新增 `Host IP` 欄 — 預設 **Phase B6 再決**，不阻塞 B0–B5。

## 6. 批次（batch）狀態機

| 狀態 | 說明 |
|------|------|
| `draft` | 已建立，檔未齊 |
| `uploaded` | 4 檔已上傳並通過結構驗證 |
| `normalizing` | 寫入 normalized_* |
| `mapping` | 產生 mapping_row |
| `published` | 當前有效批次，可供查詢／工單 enrich 讀取 |
| `failed` | 失敗；保留 log 與 partial 資料 |

同一時間僅 **一個** `published` 批次（V1）；發佈新批次時舊批次改 `archived`。

## 7. 需求 ID（Track B）

| ID | 標題 | 本 spec 章節 |
|----|------|----------------|
| **REQ-PLAT-001** | `mapping_row` DB + migration | §3–4 |
| **REQ-PLAT-002** | 匯入／正規化／映射 pipeline | §4、plan B2–B3 |
| **REQ-PLAT-003** | 匯出契約 + serializer + golden | §5、plan B0 |
| **REQ-PLAT-004** | 映射 xlsx/csv 匯出 API/CLI | §5、plan B4 |
| **REQ-PLAT-005** | Published batch 查詢 API | §6、plan B5 |
| **REQ-PLAT-006** | Helpdesk 匯出共用契約 | §5.4、plan B6 |

## 8. 明確排除（V1）

- SharePoint 下載寫入映射（**REQ-OPS-001** 維持獨立可選）。
- Tickets 進入映射 DB。
- 即時 AD / Zentera API 抓檔。
- 完整審批工作流。

## 9. 待決策

| ID | 問題 | 建議預設 |
|----|------|----------|
| D-TICKET-01 | 工單 Excel 是否加 `Host IP` | 延後 B6 |
| D-DB-01 | 程式目錄：`platform/` vs `Mapping ADGroup、Zentera/apps/` | `platform/` 於 repo 根（與 server/ 並列） |
| D-DB-02 | 保留幾代 published/archived batch | 至少 3 代 |
| D-MAIL-01 | 映射匯出是否自動補 `@deltaww.com` | 否（僅工單匯出補） |

## 10. 文件維護

變更欄位時順序：

1. 更新 `mapping-export-schema.json`
2. 更新本 spec §3.2
3. 更新 migration + serializer + golden
4. 更新 [`helpdesk-backlog.md`](2026-06-02-helpdesk-backlog.md) 與 [`PROGRESS.md`](../../PROGRESS.md)

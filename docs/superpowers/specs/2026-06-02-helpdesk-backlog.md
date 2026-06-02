# Helpdesk DDP — 待完成需求總表（Backlog）

> **狀態**：Living document  
> **最後更新**：2026-06-02（Phase 1 結案確認；有效執行清單見 phase-2-todo）  
> **Track B（平台映射 DB）：** [`plans/2026-06-03-platform-track-b-plan.md`](../plans/2026-06-03-platform-track-b-plan.md)  
> **Phase 2–4（工單 Web）：** 見各 phase todo；主線 Phase 2A–3 已合併 `master`
> **對應開發計劃**：[`plans/2026-06-02-helpdesk-development-roadmap.md`](../plans/2026-06-02-helpdesk-development-roadmap.md)  
> **進度儀表板**：[`docs/PROGRESS.md`](../../PROGRESS.md)

## 1. 已完成階段（摘要）— Phase 1 結案（2026-06-02 確認）

**結論：** Phase 2 之前的主線功能均已落地；剩餘為 **Phase 2A/2B 業務補齊** 與 **Phase 3+ 細部／平台線**，非重作 Phase 1。

下列 spec / plan 已交付，僅列索引，細節見各檔「Delivery Boundary」。

| 階段 | Spec / Plan | 交付物 |
|------|-------------|--------|
| Ticket Preview | `2026-05-22-helpdesk-ticket-preview-design.md` | Live/Sample 取票、UI |
| AD Enrichment | `2026-05-28-helpdesk-ad-enrichment-design.md` | LDAP enrich、Enrich Current |
| DDP Filter + Fetch+Enrich | `2026-05-29-helpdesk-ddp-enrich-workflow-design.md` | DDP 過濾、一鍵 enrich |
| Processed DDP View（Phase 1） | `2026-05-29-helpdesk-processed-ddp-view-design.md` | 解析、tracker、Processed 表 |
| Excel 匯出（Phase 2 初版） | `IT工單/.../process_ddp_tickets.py` 對齊 | `server/excel/*`、Export Excel |

**Phase 1 spec 曾標為 out of scope、現已完成者：** Excel 工作簿生成（基礎版）、Zentera CSV 內嵌索引（VM 查詢）。

---

## 2. 待完成需求清單（依優先級）

優先級：**P0** 阻擋營運正確性 · **P1** 下一迭代核心 · **P2** 增強 / 對齊舊流程 · **P3** 平台線 / 可延後

### 2.1 業務規則與資料正確性（P0–P1）

| ID | 優先級 | 需求 | 現況 | 驗收標準 |
|----|--------|------|------|----------|
| **REQ-VM-001** | P0 | **VM 查詢鏈改為**：申請人 user → 其 manager → **manager 的** Zentera Role → Application → Hostname | 現為 requester 的 `managerAccount` → User_Roles → Server_Profiles（語意可能不符 notebook） | 與 `ddp_analysis.ipynb` / 平台草案一致；單元測試覆蓋多 VM、無 VM、無 manager；Processed + Excel 的 `VM HostName` 同源 |
| **REQ-ID-001** | P1 | **申請人帳號**：描述內「申請人／使用者帳號」與 Helpdesk `requester` 分流規則 | 以 requester + LDAP 為主；描述 AD 帳號與 requester 衝突時行為未寫死 | 新增 spec 小節 + `parseDdpTicket` / `resolveProcessedIdentity` 測試；文件說明優先序 |
| **REQ-ID-002** | P1 | **First/Last Name**：維持 `{First}.{Last}` 大小寫不 title case；中文名拆分規則與 Python 一致 | ✅ 已實作；需回歸測試鎖定 | 既有 `parseAdName.test.ts` 擴充邊界案例 |
| **REQ-EXL-002** | P1 | **異常規則對齊策略**：Processed `abnormalFlags`（含 `missing-vm-hostname`、`ambiguous-vm-hostname`）與 Excel「異常」欄是否一致 | Excel 僅對齊 Python 三類；UI 旗標較多 | 產品決策後：要麼 Excel 納入 Zentera 缺 VM，要麼 UI 文件標註差異 |

### 2.2 Excel 與營運輸出（P1–P2）

| ID | 優先級 | 需求 | 現況 | 驗收標準 |
|----|--------|------|------|----------|
| **REQ-EXL-001** | P1 | Excel 填入 **Role、Application**（及可選 User Roles）自 Zentera／推導規則 | 欄位存在但為空 | 匯出樣本與 notebook `ad_user_vm_mapping` 抽樣比對 ≥N 筆 |
| **REQ-EXL-003** | P2 | Excel 其餘延伸欄：NAS、NEW VM、Template、Location | 空欄 | 有資料來源再填；否則 spec 標記「刻意留空」 |
| **REQ-EXL-004** | P2 | 匯出 **黃金檔 / snapshot** 測試（openpyxl 產物 vs exceljs） | 僅邏輯單元測試 | CI 可比對 sheet 名、列數、關鍵儲存格 |
| **REQ-EXL-005** | P3 | CLI 鎖檔：互動重試（對齊 Python tkinter）或文件化「僅時間戳備援」 | CLI 有備援檔名 | 操作文件更新 |

### 2.3 AD / LDAP（P1–P2）

| ID | 優先級 | 需求 | 現況 | 驗收標準 |
|----|--------|------|------|----------|
| **REQ-AD-001** | P1 | **中文 AD Name 亂碼**（編碼、LDAP 屬性、Helpdesk requester） | 🟡 個案待查 | 重現 fixture + 修正 normalize／顯示 |
| **REQ-AD-002** | P1 | **`missing-ad-account` 與 mail 並存** | 🟡 | 釐清：enrich 失敗 vs 描述有 mail 無帳號；旗標邏輯調整 |
| **REQ-AD-003** | P2 | BU 來源：內部 user/info HTML（Python）vs 僅 LDAP `extensionAttribute2` | Web 用 LDAP | 決策：補 HTTP 查詢或接受 LDAP-only |
| **REQ-AD-004** | P3 | 群組成員匯出 / Group lookup | spec 標 out of scope | 另開平台或 AD 工具 spec |

### 2.4 舊 Python 流程殘項（P2–P3）

| ID | 優先級 | 需求 | 現況 | 驗收標準 |
|----|--------|------|------|----------|
| **REQ-OPS-001** | P2 | SharePoint 檔案下載（若仍需要） | ⬜ | 可配置路徑；與取票串接或獨立 CLI |
| **REQ-OPS-002** | P3 | Windows 工作排程器包裝（fetch → process → excel） | ⬜ | 文件 + `.ps1` 或 task XML 範本 |
| **REQ-OPS-003** | P3 | 離線批次：`pnpm fetch:tickets` → enrich → export 一鍵腳本 | 三步獨立指令 | `pnpm workflow:ddp` 類似編排 |

### 2.5 工程與品質（P1–P2）

| ID | 優先級 | 需求 | 現況 | 驗收標準 |
|----|--------|------|------|----------|
| **REQ-ENG-001** | P1 | **CI**：`pnpm test` + `pnpm build` on push/PR | ⬜ | GitHub Actions（或內部 CI）綠燈 |
| **REQ-ENG-002** | P2 | 修復 `fetchAndEnrichTickets` vite 路由測試逾時 | 🟡 偶發 | 測試隔離 mock / 延長 timeout |
| **REQ-ENG-003** | P2 | Processed payload 契約測試（API JSON schema） | 分散單測 | 單一 golden payload fixture |

### 2.6 平台線（Track B，與工單 Web 分軌）

**Spec：** [`2026-06-03-platform-mapping-db-export.md`](2026-06-03-platform-mapping-db-export.md) · **Contract：** [`fixtures/mapping-export-schema.json`](../fixtures/mapping-export-schema.json)

| ID | 優先級 | 需求 | 現況 | 驗收標準 |
|----|--------|------|------|----------|
| **REQ-PLAT-001** | P1 | **`mapping_row` DB**（語意 1:1 `ad_user_vm_mapping.xlsx`） | 🟡 spec 完成 | migration 欄位 = 契約 `dbColumn` |
| **REQ-PLAT-002** | P1 | 匯入 + 正規化 + 映射 pipeline（對齊 notebook） | ⬜ | 同來源重跑結果一致 |
| **REQ-PLAT-003** | P0 | **匯出契約** + serializer + golden 測試 | 🟡 JSON + plan B0 | `mapping-export-schema.json` 驅動匯出 |
| **REQ-PLAT-004** | P1 | 映射 xlsx/csv 匯出 CLI/API | ⬜ | 表頭/順序/儲存格型別對齊契約 |
| **REQ-PLAT-005** | P2 | Published batch 查詢 API | ⬜ | 供 UI / enrich 讀取 |
| **REQ-PLAT-006** | P2 | Helpdesk 工單匯出共用 `mappingFieldId` | ⬜ | `buildDdpExcelRows` 與平台同一 transform |

---

## 3. 待決策事項（需利害關係人確認）

| # | 問題 | 選項 | 建議預設 |
|---|------|------|----------|
| D1 | Excel 異常是否包含 Zentera 缺 VM？ | A) 僅 Python 三類 B) 與 UI flags 完全一致 | A，並在 UI 註明 |
| D2 | VM 查詢用「申請人 manager」還是「manager 的 manager」？ | 對照 notebook 一筆真實工單 | 以 notebook SQL 為準寫入 spec |
| D3 | BU 是否恢復 Python HTTP user/info？ | LDAP only / HTTP fallback | LDAP only，除非營運要求 |
| D4 | SharePoint / 排程是否仍要？ | 要 / 不要 / 僅文件 | 訪談後定 P2/P3 |
| D5 | 平台 DB 與工單 Web 是否共用 repo？ | 同 repo 不同 app / 拆 repo | 同 repo、`Mapping ADGroup、Zentera/` 目錄 |

---

## 4. 與 legacy 欄位對照（Processed / Excel）

| 欄位 | Processed View | Excel 匯出 | 待辦 |
|------|----------------|------------|------|
| AD Account | ✅ | ✅ | REQ-ID-001 |
| VM HostName | ✅（Zentera 補值） | ✅ | REQ-VM-001 |
| Role | — | 空 | REQ-EXL-001 |
| Application | — | 空 | REQ-EXL-001 |
| Group Owner | — | 固定值 ✅ | — |
| 異常 | flags[] | 紅底+連結 ✅ | REQ-EXL-002 |

---

## 5. 需求 → 計劃階段對照

| 需求 ID | 開發計劃階段 |
|---------|----------------|
| REQ-VM-001, REQ-ID-001, REQ-ID-002, REQ-EXL-002 | **Phase 2A** |
| REQ-EXL-001, REQ-EXL-003, REQ-EXL-004 | **Phase 2B** |
| REQ-AD-001, REQ-AD-002, REQ-AD-003 | **Phase 3** |
| REQ-ENG-001, REQ-ENG-002, REQ-ENG-003 | **Phase 3**（可並行） |
| REQ-OPS-001～003 | **Phase 4**（可選） |
| REQ-PLAT-001～006 | **Track B**（[`2026-06-03-platform-track-b-plan.md`](../plans/2026-06-03-platform-track-b-plan.md)） |

---

## 6. 維護

- 需求狀態變更時：更新本檔 + [`docs/PROGRESS.md`](../../PROGRESS.md) + 計劃內 checkbox。
- 新增需求：分配 `REQ-*` ID，標明優先級與階段。

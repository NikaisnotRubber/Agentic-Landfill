# VM Master 架構優化評估與待辦（內部用）

> **對象：** 自己（後續優化規劃參考）
> **撰寫日期：** 2026-07-06
> **範圍：** 整體架構評估（`platform/`、`server/`、`src/`、DB schema、CQRS 手動編輯流程）
> **依據：** 現行程式碼 review（見各節引用的檔案路徑），`docs/PROGRESS.md`、`docs/superpowers/specs|plans/*`
> **備註：** 本報告已補充透過 context7 查證的官方文件依據（Vite、`@tanstack/vue-table`、ExcelJS、ldapts、Node.js `node:sqlite`），標示為「〔context7 查證〕」。

---

## 一、現有技術棧

- **前端**：Vue 3 Composition API（無 Pinia/Vuex，狀態靠 composable，例如 [`useVmMasterPreview.ts`](../../../src/features/vm-master/useVmMasterPreview.ts)）+ `@tanstack/vue-table` 渲染表格，Vite 8 建構。
- **後端**：沒有獨立 Node 伺服器進程。所有 `/api/*` 路由是以 `server.middlewares.use(...)` 掛在 Vite dev server 上（見 [`vite.config.ts:25-49`](../../../vite.config.ts)）。
- **資料庫**：`node:sqlite`（原生模組，非 better-sqlite3），**兩個獨立 SQLite 檔案**：
  - `data/vm-master.sqlite`（VM Master，schema 見 [`db/schema/001_vm_master_schema.sql`](../../../db/schema/001_vm_master_schema.sql)）
  - `data/platform.db`（AD × Zentera 映射平台，schema 見 [`platform/db/schema.ts`](../../../platform/db/schema.ts)）
- **其他**：`exceljs`（Excel 解析）、`ldapts` + 自製 Windows 整合查詢（LDAP）、`csv-parse`、`playwright`（Helpdesk 登入自動化）、Vitest（48 個測試檔）。
- **CI**：`.github/workflows/ci.yml` 跑 `pnpm install --frozen-lockfile` → `pnpm test` → `pnpm run build`，無 lint/typecheck 獨立 step、無 deploy step。

---

## 二、架構評估重點發現

### 2.1 〔高〕系統事實上沒有可獨立部署的後端 — 只能靠 `pnpm dev` 運行

`/api/vm-master/*`、`/api/tickets/*` 等所有路由都是 Vite dev server 的 middleware（[`vite.config.ts:25-122`](../../../vite.config.ts)）。`pnpm build` 只會建置前端靜態資源（`vite build`），沒有對應的「啟動正式後端」腳本（`package.json` 只有 `dev` / `build` / `test`，沒有 `start` 或 `serve`）。

**影響：** 現階段這套系統無法用一般「build → 部署到正式環境」的方式上線；只要停掉開發伺服器，所有 API 就不存在了。這是目前最大的架構債，也是業務報告中提到「無法正式部署」的技術根源。

**方向：** 抽出一個獨立的 Node HTTP 服務（Express/Fastify 皆可，專案已經是手寫 `sendJson`/`readBody` 的極簡風格，見 [`server/http.ts`](../../../server/http.ts)，換裝一個輕量框架成本不高），讓 `server.middlewares.use` 註冊的 handler 可以在 dev 和正式環境共用同一組函式（目前的 handler 大多已經是純函式 + 依賴注入風格，例如 `createVmMasterPreviewHandler(repository)`，遷移成本應該可控）。

**〔context7 查證〕** Vite 官方文件（[`vitejs/vite` — SSR / middleware mode guide](https://github.com/vitejs/vite/blob/main/docs/guide/ssr.md)）本身推薦的整合方式就是：用 `createServer({ server: { middlewareMode: true }, appType: 'custom' })` 建立 Vite 實例，再用 `app.use(vite.middlewares)` 掛進一個獨立的 Express（或其他框架）app，正式環境再用同一個 Express app（不含 `vite.middlewares`）搭配 build 後的靜態檔案提供服務。這正好印證上面的方向：現在的做法（把 handler 直接掛在 Vite plugin 的 `configureServer` 上）是官方文件裡「dev-only 整合」的寫法，還缺最後一步——把同一組 handler 掛到一個正式環境也會啟動的 Express app 上。

### 2.2 〔高〕API 完全沒有身份驗證/授權層，且審計欄位是寫死字串

- 所有 `/api/vm-master/*` 路由沒有任何 auth middleware（`grep` 全專案 `server/*.ts` 沒有 authenticate/authorization 相關程式碼）。
- 手動編輯發布時，前端目前把 `changedBy` 寫死成常數字串 `"manual-edit"`（[`useVmMasterPreview.ts:182`](../../../src/features/vm-master/useVmMasterPreview.ts)），而不是真實操作者身份。`vm_master_manual_edit_commands.changed_by` 因此形同虛設，稽核表（`vm_master_manual_edit_changes`）雖然記錄了 before/after，但無法回答「是誰改的」。

**影響：** 目前的 CQRS 稽核機制只解決了「改了什麼」，沒有解決「誰改的」與「誰能改」，離正式上線要求還有距離。

**方向（短期低成本）：** 先讓 `changedBy` 從一個簡單機制取得（例如環境變數指定操作者、或至少要求前端輸入操作者名稱），再談完整登入系統。權限模型可以晚一點做，但「誰動的手」這件事現在就該修。

**〔context7 查證〕延伸發現 — LDAP 連線目前是明文，未加密：** [`ldapClient.ts:103`](../../../server/ad/ldapClient.ts) 建立連線時寫死 `ldap://${dcHost}`（非 `ldaps://`）。ldapts 官方文件（[`ldapts/ldapts` README](https://github.com/ldapts/ldapts/blob/main/README.md)）明確建議：「For production environments, it is mandatory to use `ldaps://` or `startTLS()` to ensure all communication is encrypted」。目前系統向 AD 查詢的帳號、部門、主管等身分資料是在內網以明文傳輸，這與 §2.2 的「沒有存取控制」是同一類風險的兩個面向——一個是誰能打 API，一個是內部查詢本身有沒有加密。短期若要重視，只需把 `dcHost` 的連線字串從 `ldap://` 換成 `ldaps://`（或呼叫 `startTLS()`），只要 AD 網域控制站支援即可，改動範圍很小。

### 2.3 〔中〕CQRS 目前只做到「寫入面分離＋稽核表」，還沒有真正的 outbox 消費者

[`2026-06-30-vm-master-preview-manual-publish-design.md`](../specs/2026-06-30-vm-master-preview-manual-publish-design.md) 明確保留 `published_at` 給「未來的 outbox worker / 訊息佇列」，目前永遠是 `NULL`（[`repository.ts:247`](../../../server/vmMaster/repository.ts) insert 時未寫入該欄位）。

**現況是合理的**（spec 本來就聲明這次迭代不做 worker），但如果之後有其他系統要消費「VM 總表異動事件」，現在的表結構已經預留了欄位，只是還沒有人在讀它。**這不是缺陷，是待實現的擴充點**，記錄下來避免忘記。

### 2.4 〔中〕兩個獨立 SQLite 資料庫，職責有重疊但未收斂

`data/vm-master.sqlite`（`vm_users` / `vm_machines` / `vm_user_vm_assignments`）與 `data/platform.db`（`mapping_row`，欄位包含 `ad_account`、`bg`、`bu`、`role_export`、`vm_hostname` 等）在概念上都是「使用者 × VM × 角色」的映射，但目前是兩條平行的資料管線（[`docs/superpowers/reports/2026-06-09-internal-vm-mapping-technical-report.md`](../reports/2026-06-09-internal-vm-mapping-technical-report.md) 對此有更完整的歷史脈絡）。

**風險：** 兩邊資料没有一致性檢查機制；同一位使用者的 BG/BU/VM 對應，理論上兩邊都可能各自被更新而不同步。目前 `USE_PLATFORM_MAPPING_DB` 環境變數只在 DDP 工單 enrich 路徑上讀 `platform.db`，VM Master 模組完全不碰它，两者目前是「井水不犯河水」，暫時安全，但長期看是重複建設。

**方向：** 中長期評估是否能收斂成一個資料庫、或至少建立一個排程/腳本定期比對兩邊資料是否一致（不必馬上合併，先有「差異偵測」）。

### 2.5 〔低〕Excel 匯入與 Helpdesk 同步共用了核心 repository 函式，但快取層各自為政

好消息：`findManagerAdName`、`findManagerAssignments`、`replaceUserVmAssignments`、`upsertVmUserForSync`、`createAdLookupClient` 這些核心邏輯已經在 [`repository.ts`](../../../server/vmMaster/repository.ts) 集中共用，`helpdeskSync.ts` 和 `excelImport.ts` 都是呼叫同一組函式，並沒有重複實作 enrich 邏輯——這點架構是乾淨的。

但 [`excelImport.ts:685-690`](../../../server/vmMaster/excelImport.ts) 為了批次效能，在單次執行內手刻了 5 個 `Map` 做快取（`existingUserCache`、`userLookupCache`、`managerAccountCache`、`managerAdNameCache`、`managerAssignmentsCache`、`assignmentDefaultsCache`），而 `helpdeskSync.ts` 沒有對應快取（工單量通常較小，暫時沒問題）。如果未來 Helpdesk 同步的單批工單量變大，或是又新增第三條批次匯入路徑，這個「每次執行手刻 Map 快取」的模式會被複製第三次。

**方向：** 不急，但如果要新增第三個批次寫入場景，值得把這層「執行期快取」抽成一個小型可重用工具（例如 `createExecutionScopedLookupCache()`），而不是再刻一次。

### 2.6 〔低〕每個 API request 都重新開關 SQLite 連線 + 重跑 schema migration

`createVmMasterPreviewRepository`、`createManualEditCommandRepository` 等每次請求都呼叫 `openVmMasterDatabase()` → `applyVmMasterSchema()` → 查詢 → `database.close()`（例如 [`routes.ts:14-21`](../../../server/vmMaster/routes.ts)、[`manualEditRoute.ts:20-29`](../../../server/vmMaster/manualEditRoute.ts)）。`applyVmMasterSchema` 每次都重新執行 `CREATE TABLE IF NOT EXISTS` 與欄位遷移檢查（[`sqlite.ts:107-112`](../../../server/db/sqlite.ts)）。

**影響：** 現在資料量小、請求量低，看不出效能問題；但這是典型「PoC 沒問題、正式量體會出問題」的模式 —— 每個請求都做一次 schema 檢查是浪費的 I/O，且 `node:sqlite` 是單檔鎖定，Excel 大批匯入與 manual-edit 發布如果同時發生，有機會互相等鎖。

**方向：** 等真的要做 2.1（獨立後端服務）時，順便把 DB 連線改成常駐單例、schema migration 只在啟動時跑一次，這兩件事可以一起做，不用現在單獨處理。

**〔context7 查證〕** Node.js 官方文件確認 `node:sqlite` 目前是 **Stability 1.2 — Release Candidate**（尚未到 Stable，[`nodejs/node` sqlite.md](https://github.com/nodejs/node/blob/main/doc/api/sqlite.md)），且 `DatabaseSync` 建構子有一個 `timeout`（busy timeout）選項可設定「等待資料庫解鎖的最長時間」，但 [`sqlite.ts:20`](../../../server/db/sqlite.ts) 目前 `new DatabaseSync(databasePath)` 呼叫時**沒有傳入 `timeout`**，等於用預設值（不同版本文件對預設值描述不一致，實務上應視為「不保證會重試等鎖，可能直接丟 SQLITE_BUSY」）。如果 Excel 大批匯入與 manual-edit 發布真的撞在一起，目前的設定下失敗模式會是「直接報錯」而非「排隊等待」。這是一個比原本推測更具體的行動項：**在做 2.1 的常駐連線重構時，順手把 `timeout` 設定為合理值（例如 5000ms）**。

### 2.7 〔低〕手動編輯目前只能改既有列，沒有新增/刪除

`docs/PROGRESS.md` 已經自己記錄了這點（"Review VM Master manual edit and Excel import workflows before adding row create/delete or MQ publishing" 🟡），這裡只做交叉確認：[`repository.ts:233-340`](../../../server/vmMaster/repository.ts) 的 `executeVmMasterManualEditCommand` 找不到對應列會直接 `throw`（"VM Master row not found"），證實目前架構就是設計成「只改不增刪」。這是有意識的範圍限制（見 spec scope 聲明），不是遺漏，記錄在此供之後排優先序。

### 2.8 〔低〕CI 沒有獨立的 typecheck/lint step

`ci.yml` 只跑 `pnpm test` 和 `pnpm run build`；TypeScript 型別錯誤要嘛靠 `vite build` 順帶擋下、要嘛靠 Vitest 執行時才發現，沒有專門的 `tsc --noEmit` 或 lint step 把關。目前專案規模小，影響有限，但值得記錄。

### 2.9 〔context7 查證，低〕Excel 匯入是整檔載入記憶體，未使用 ExcelJS 的串流讀取

[`excelImport.ts:199-201`](../../../server/vmMaster/excelImport.ts) 用 `new ExcelJS.Workbook()` + `workbook.xlsx.load(workbookBuffer)` 讀取整個上傳的活頁簿。ExcelJS 官方文件（[`exceljs/exceljs` README](https://github.com/exceljs/exceljs/blob/master/README.md)）另外提供 `ExcelJS.stream.xlsx.WorkbookReader`，可以用 async iterator 逐列讀取，不必把整個檔案載入記憶體，官方文件明確標註這是給大檔案用的寫法。

這與現有設計文件的決策一致——[`2026-07-01-vm-master-excel-import-design.md`](../specs/2026-07-01-vm-master-excel-import-design.md) 明確聲明「No server-side temporary workbook storage」，也就是設計上就是要整檔在記憶體處理、不落地暫存檔，所以目前用 `workbook.xlsx.load(buffer)` 是配合這個決策的合理選擇，**不是錯誤**。但如果之後上傳的 Excel 檔案變大（例如上千列 × 多工作表），現在的整檔載入方式記憶體用量會隨檔案大小線性成長，屆時值得評估換成串流讀取，或至少在 preview 端點加上檔案大小上限檢查（目前程式碼沒看到任何大小限制）。

**方向：** 不急，先加一個檔案大小上限的輸入驗證（低成本);真的遇到大檔案效能問題時再考慮串流讀取（會牽動目前「讀完整個 workbook 再算 headers/sample rows/mapping」的邏輯，改動不小）。

### 2.10 〔context7 查證，低，前瞻性〕`@tanstack/vue-table` 未來升級到 v9 會是破壞性變更

[`VmMasterTable.vue:8`](../../../src/features/vm-master/VmMasterTable.vue) 使用 `useVueTable` API，符合目前鎖定的 `^8.21.3`（見 [`package.json`](../../../package.json)）。TanStack Table 官方文件確認 **`useVueTable` 在 v9 被移除，改用 `useTable`**（[`tanstack/table` Vue skill doc](https://github.com/tanstack/table/blob/beta/packages/vue-table/skills/vue/table-state/SKILL.md)）。目前專案沒有升級壓力，純粹記錄下來：**未來若要跳到 v9，`useVueTable` → `useTable` 是已知的破壞性變更，需要連同 grouping/expanding API 一併檢查**（v9 的 grouping 寫法也改成 `tableFeatures({ columnGroupingFeature, groupedRowModel, ... })` 的組合式寫法，跟目前 v8 的用法不同）。

---

## 三、建議優化路線圖

### 短期（低成本、高價值，可在下一兩個迭代處理）

- [ ] `changedBy` 改成從真實來源取得（至少先做到「操作者可辨識」，不必等完整登入系統）— 對應 §2.2。
- [ ] 為 `/api/vm-master/*` 加上最低限度存取控制（IP allowlist 或簡單 basic auth），先擋掉「任何連得到網路的人都能改資料」的風險 — 對應 §2.2。
- [ ] LDAP 連線由 `ldap://` 改為 `ldaps://`（或加 `startTLS()`），確認 AD 網域控制站支援後即可切換 — 對應 §2.2（context7 查證）。
- [ ] Excel 匯入 preview 端點加上檔案大小上限驗證 — 對應 §2.9（context7 查證）。
- [ ] 補一個 `data/vm-master.sqlite` vs `data/platform.db` 的差異偵測腳本（唯讀比對，不用合併）— 對應 §2.4。

### 中期（需要規劃一次迭代）

- [ ] 把 Vite dev middleware 路由抽成獨立 Node 後端服務（可比照 Vite 官方 `middlewareMode` + Express 的整合方式），讓系統可以脫離 `pnpm dev` 部署；同時把 DB 連線改成常駐單例、`timeout`（busy timeout）設定合理值、schema migration 移到啟動階段 — 對應 §2.1、§2.6（皆有 context7 查證）。
- [ ] 評估兩個 SQLite 資料庫是否收斂為一個，或明確劃分邊界並文件化 — 對應 §2.4。
- [ ] 若批次匯入場景增加到第三種，抽出共用的「執行期查詢快取」工具 — 對應 §2.5。

### 長期（視業務規模擴大再啟動）

- [ ] 實作 outbox worker，讓 `vm_master_manual_edit_commands.published_at` 真正被消費，串接訊息佇列 — 對應 §2.3。
- [ ] VM 對應的新增/刪除 API + 前端操作 — 對應 §2.7。
- [ ] 使用者角色與權限模型、審批流程 — 對應 §2.2 延伸。
- [ ] CI 加上獨立 typecheck/lint step — 對應 §2.8。

---

## 四、待確認問題（留給未來的自己）

1. `platform.db` 這條映射平台的資料流，長期是否還要維持獨立於 VM Master 之外？還是應該把 VM Master 當作唯一正式資料源，`platform.db` 降級為唯讀報表？
2. 如果要做正式後端服務，是否要順便換掉 `node:sqlite`（目前官方狀態是 Release Candidate，尚未 Stable）成 `better-sqlite3` 或直接上 Postgres？取決於未來是否有多實例部署需求，以及對「等 RC 轉正式 Stable」的風險容忍度。
3. 權限模型如果要做，是接公司既有的 AD/SSO，還是自建一套簡單帳密？這決定了短期「先擋一道」方案要不要考慮相容性。
4. `@tanstack/vue-table` 目前鎖在 v8，未來若跟著上游升級到 v9，`useVueTable → useTable` 的破壞性變更要抓進哪一次迭代處理？現在不用做，但排 roadmap 時應該知道這筆債存在。

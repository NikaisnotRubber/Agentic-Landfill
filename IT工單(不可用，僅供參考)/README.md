# DDP 工單自動化

自動從 IT Helpdesk 抓取 DDP 申請工單，解析非結構化文字，輸出整理好的 Excel 維護表。

---

## 交接步驟（新人必讀）

### 1. 安裝環境

```bash
pip install playwright openpyxl python-dotenv requests
playwright install chromium
```

### 2. 建立 `.env`

```bash
copy .env.example .env
```

打開 `.env`，修改以下三項：

| 變數 | 改成 |
|---|---|
| `ITHELPDESK_USER` | 你的 AD 帳號（e.g. `FIRSTNAME.LASTNAME`） |
| `ITHELPDESK_PASS` | 你的密碼 |
| `TECHNICIAN` | 你的 AD 帳號 + 中文名（e.g. `FIRSTNAME.LASTNAME 王小明`） |
| `EXCEL_OUTPUT` | 你的 OneDrive 路徑或本機路徑 |

### 3. 首次登入

```bash
python login.py
```

瀏覽器會開啟並停在 SSO 登入畫面，完成 SSO 後回到終端機按 Enter，即存好 `delta_sso_state.json`。

### 4. 測試執行

```bash
python run_all.py
```

確認 `EXCEL_OUTPUT` 路徑下有輸出 Excel 即完成。

### 5. 設定排程（Windows Task Scheduler）

先刪掉前任的排程，再建新的：

```bash
# 刪除前任排程（如果存在）
for %H in (09_00 11_00 13_00 15_00 17_00) do schtasks /delete /tn "DDP_WorkOrder_%H" /f

# 建立新排程（以 09:00 為例，其餘照改時間）
schtasks /create /tn "DDP_WorkOrder_09_00" /tr "cmd /c pushd \"C:\path\to\IT工單\" && run_all.bat" /sc daily /st 09:00 /f
```

> **注意**：排程是綁在建立者的 Windows 帳號下執行，換人後一定要重建。

### 注意事項

- **`delta_sso_state.json`** 是前任的 session，不能直接用，必須重新執行 `login.py`。
- **`.env`** 不在 git 版控中（已加入 `.gitignore`），不會附在交接包裡，需自己建立。

---

## 快速開始

```bash
python run_all.py
```

輸出路徑由 `.env` 的 `EXCEL_OUTPUT` 決定（預設 `ddp_ticket_maintain.xlsx`）。

---

## 檔案說明

| 檔案 | 用途 |
|---|---|
| `run_all.py` | **入口點**，依序執行 Step 1 → Step 2 |
| `run_all.bat` | Task Scheduler 用的啟動腳本，log 寫入 `run_log.txt` |
| `login.py` | SSO 登入工具，手動執行一次後儲存 session（session 過期時使用） |
| `fetch_tickets_api.py` | Step 1：用 Playwright 登入 Helpdesk，透過 API 抓工單 JSON |
| `process_ddp_tickets.py` | Step 2：解析 JSON，查詢 BU，輸出格式化 Excel |
| `delta_sso_state.json` | Playwright 的 session 狀態（登入後自動維護，勿手動編輯） |
| `delta_tickets_clean.json` | Step 1 的輸出，Step 2 的輸入 |
| `last_seen_id.txt` | 記錄上次看到的最新工單 ID，用來偵測新工單 |
| `run_log.txt` | 排程執行的 log（自動附加，不存在時自動建立） |
| `ddp_ticket_maintain.xlsx` | 最終輸出的 Excel 維護表 |
| `ddp_ticket_maintain_YYYYMMDD_HHMM.xlsx` | Excel 被鎖定時的備份檔（自動產生） |

---

## 設定（run_all.py 頂端）

```python
TECHNICIAN   = "JIAHUA.WU 吳家驊"   # 負責人過濾，留空字串則抓全部
TICKET_COUNT = 100                    # 每次抓幾筆
TICKETS_JSON = "delta_tickets_clean.json"
EXCEL_OUTPUT = "ddp_ticket_maintain.xlsx"
```

---

## 各 Step 說明

### Step 1 — `fetch_tickets_api.py`

- 用 Playwright headless Chromium 登入 `ithelpdesk.deltaww.com`
- Session 存在 `delta_sso_state.json`，若過期需重新登入
- 透過網站內建 API 撈工單（filter by technician、sort by created_time desc）
- 比對 `last_seen_id.txt` 偵測新工單；若 last_seen_id 不在本批次中會印警告（代表 `--count` 太小）
- 輸出 `delta_tickets_clean.json`

**參數：**
```bash
python fetch_tickets_api.py --count 100 --output delta_tickets_clean.json --technician "JIAHUA.WU 吳家驊"
```

---

### Step 2 — `process_ddp_tickets.py`

吃 JSON，用 Regex 從 `short_description`（非結構化文字）拆欄位，輸出 Excel。

**解析欄位：**

| 欄位 | 來源 | 說明 |
|---|---|---|
| AD Account | `short_description` 或 `requester` | 優先用 requester，需與 desc 比對一致才採用 |
| AD Name | `requester` 欄位（`ACCOUNT 中文名` 格式） | |
| FirstName / LastName | 中文名拆字（姓=LastName, 名=FirstName）；無中文名則從 AD Account 點號切 | |
| Mail | desc 或 requester；找不到則補 `{AD Account}@deltaww.com` | |
| BU | `http://twtpeclm01b.delta.corp/user/info?action={AD Account}` | 解析 HTML 中的 BU 欄位；同帳號結果 cache，不重複查詢 |
| NB Hostname | 關鍵字：`使用者電腦名稱`、`電腦編號(NB)`、`NB Hostname` 等 | 超過 11 碼截斷（台達命名規則） |
| VM HostName | 關鍵字：`連線 DDP 主機名稱`、`Connect VM`、`VM` 等 | 若為無效佔位值（hostname、localhost、127.0.0.1 等）則清空並標異常 |

**異常標記（異常欄標紅 + 超連結）：**
- `AD Account` 空白
- `NB Hostname` 空白
- `VM HostName` 填了無效佔位值（hostname / localhost / 127.0.0.1 / vm / n/a 等）

**參數：**
```bash
python process_ddp_tickets.py --input delta_tickets_clean.json
```

---

## Excel 輸出結構（`ddp_ticket_maintain.xlsx`）

| Tab | 內容 |
|---|---|
| **待處理** | Open / Onhold 工單（工單狀態欄**黃底**，代表仍需處理） |
| **Closed** | 已結案工單 |
| **All** | 全部工單存底 |

**顏色規則：**
- 工單狀態欄**黃底** → Open / Onhold，仍需處理
- 異常欄**紅底 + 超連結** → 資料不完整，點連結開對應工單確認

**欄位順序：**
`Ticket ID` / `異常` / `工單狀態` / `AD Account` / `AD Name` / `FirstName` / `LastName` / `Mail` / `BU` / `Role` / `NB Hostname` / `Group Owner` / `Group Name` / `NAS Folder Name` / `VM HostName` / `NEW VM` / `User Roles` / `Application` / `Template Name` / `Location`

> `Group Owner` 固定填 `G-Delta-rollout_admin`；`Group Name` 留空人工填。

---

## 環境需求

```bash
pip install playwright openpyxl python-dotenv
playwright install chromium
```

**環境變數（`.env` 或系統設定）：**

| 變數 | 說明 | 預設值 |
|---|---|---|
| `DELTA_STATE_FILE` | Playwright session 路徑 | `delta_sso_state.json` |
| `DELTA_BASE_URL` | Helpdesk 首頁 URL | `https://ithelpdesk.deltaww.com/WOListView.do` |
| `DELTA_ID_TRACKER` | 新工單追蹤檔路徑 | `last_seen_id.txt` |

---

## 排程設定（Windows Task Scheduler）

已建立五個排程，上班時間每兩小時自動執行一次：

| 排程名稱 | 執行時間 |
|---|---|
| DDP_WorkOrder_09_00 | 09:00 |
| DDP_WorkOrder_11_00 | 11:00 |
| DDP_WorkOrder_13_00 | 13:00 |
| DDP_WorkOrder_15_00 | 15:00 |
| DDP_WorkOrder_17_00 | 17:00 |

排程觸發 `run_all.bat`，stdout / stderr 附加寫入 `run_log.txt`。

**管理排程：**
```bash
# 查看
schtasks /query /tn "DDP_WorkOrder_09_00"

# 刪除單一排程
schtasks /delete /tn "DDP_WorkOrder_09_00" /f

# 刪除全部
for %H in (09_00 11_00 13_00 15_00 17_00) do schtasks /delete /tn "DDP_WorkOrder_%H" /f
```

**Excel 被鎖定時：**
不會中斷，改存成 `ddp_ticket_maintain_YYYYMMDD_HHMM.xlsx`，並在 `run_log.txt` 記錄時間。

---

## 常見問題

**Session 過期 → API 回傳 401**
執行 `python login.py`，瀏覽器會開啟停在登入畫面，完成 SSO 後回終端機按 Enter，自動存好新的 `delta_sso_state.json`。
若排程跑到 401，`fetch_tickets_api.py` 會自動觸發同樣的登入流程（開瀏覽器 + 等 Enter）。

**`last_seen_id` 不在本批次 → 警告但不誤報**
調大 `TICKET_COUNT`（`run_all.py` 頂端設定）。

**print 中文亂碼**
Windows cmd 使用 cp950，對執行結果無影響，Excel 內容正常。

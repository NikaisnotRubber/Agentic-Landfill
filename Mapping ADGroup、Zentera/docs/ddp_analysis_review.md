# ddp_analysis.ipynb 分析報告

## 範圍與說明

- 分析對象：`ddp_analysis.ipynb` 與同層資料檔 `groups_LTW_all.xlsx`、`User_Roles_202603231446.csv`、`Users_202603231447.csv`、`Server_Profiles_202603231446.csv`
- 分析方式：以 notebook 原始碼與既有執行輸出為主，搭配靜態檢視 Excel/CSV 結構
- `context7` 狀態：目前工作環境沒有可用的 `context7`/MCP 資源，因此本報告依本機檔案內容完成

## 一句話總結

`ddp_analysis.ipynb` 的核心功能，是把 Zentera DDP 的角色、使用者、伺服器對應，以及 AD 群組成員清單匯入本機 SQLite，做帳號正規化與關聯查詢，最後輸出一份 `ad_user_vm_mapping.xlsx`，用來整理「AD 帳號 / 人員 / 群組 / DDP Role / VM Host」之間的關係。

## 主要流程

1. 建立本機資料庫 `ddp.db`
2. 匯入 3 份 CSV 與 1 份 Excel 到 SQLite
3. 將 `User_Roles` 中一格多人的欄位展開為一人一列
4. 將 `Users` 與 `AD members` 的帳號統一轉成大寫，方便 join
5. 修正 `Users` 中部分中文姓名欄位前後顛倒的資料
6. 透過 SQL 關聯 `ad_members`、`users`、`role_user`、`servers`
7. 排除部分不需要的 AD 群組
8. 依 VM Hostname 規則回推出簡短 `Role`
9. 輸出 `ad_user_vm_mapping.xlsx`

## Notebook 內部資料表

### 載入後建立的 SQLite tables

- `roles`
  - 來源：`User_Roles_202603231446.csv`
  - 粒度：一個 DDP role 一列
- `role_user`
  - 來源：由 `roles.Users` 拆分而來
  - 粒度：一個 role-user 關係一列
- `users`
  - 來源：`Users_202603231447.csv`
  - 粒度：一個使用者一列
- `servers`
  - 來源：`Server_Profiles_202603231446.csv`
  - 粒度：一台 VM/Server 一列
- `ad_groups`
  - 來源：`groups_LTW_all.xlsx` 的 `群組清單` 工作表
  - 粒度：一個 AD 群組一列
- `ad_members`
  - 來源：`groups_LTW_all.xlsx` 除 `群組清單` 外的所有工作表
  - 粒度：一個群組成員關係一列
- `tickets`
  - 來源預期：`delta_tickets_clean.json`
  - 現況：匯入程式碼已被註解，但 notebook 輸出顯示它曾經在過去某次執行中存在

### Notebook 顯示的既有載入筆數

- `roles`: 737 rows
- `role_user`: 8,254 rows
- `users`: 6,361 rows
- `servers`: 804 rows
- `tickets`: 15 rows
- `ad_groups`: 1,500 rows
- `ad_members`: 54,664 rows

## 與周圍檔案的交互

### 1. `User_Roles_202603231446.csv`

來源欄位：

- `Customer`
- `Project`
- `Role`
- `User`
- `Application(Server Group)/Service/MSG Device Group`
- `Access Policies`

Notebook 內交互：

- 先整份寫入 `roles`
- 再把第 4 欄的人員字串依逗號切開，轉成 `role_user`
- 使用者帳號會被轉成大寫，成為之後與 `users.Account`、`ad_members.ADAccount` 對接的 key

關鍵用途：

- 提供「誰擁有哪些 DDP Role」的映射
- 作為 `role_user.User -> users.Account` 的 join 來源
- 作為 `role_user.Role -> servers.Application(Server Group)` 的 join 來源

### 2. `Users_202603231447.csv`

來源欄位重命名後：

- `Account`
- `FirstName`
- `LastName`
- `Role`
- `Application`
- `LastAccessTs`
- `LastAccess`
- `AuthType`
- `ExpirationTs`
- `Expiration`
- `Status`

Notebook 內交互：

- 去除欄名空白
- 將帳號 `Account` 轉成大寫
- 若 `LastName` 長度只有 1，視為姓名前後顛倒，與 `FirstName` 對調

關鍵用途：

- 提供帳號對應到真實姓名、狀態、登入時間等資訊
- 與 `ad_members.ADAccount` 進行 `INNER JOIN`
- 補齊輸出檔中的中文姓名與帳號狀態背景資訊

### 3. `Server_Profiles_202603231446.csv`

來源重點欄位：

- `Hostname`
- `App Profile`
- `Application(Server Group)`
- `Server Function`
- `Host IP`
- `Online Since (UTC+08:00)`

Notebook 內交互：

- 整份寫入 `servers`
- 在最終查詢中，以 `servers."Application(Server Group)" = role_user.Role` 進行連接

關鍵用途：

- 把 DDP Role 對應到實際 VM Host
- 補出輸出檔中的 `VM HostName`、`Host IP`

### 4. `groups_LTW_all.xlsx`

Excel 結構摘要：

- 共 60 個工作表
- `群組清單`：群組主檔，`1500` 筆資料
- 其餘 59 個工作表：代表不同 BG/分類底下的成員清單
- 成員工作表總資料列約 `54,664` 筆，與 notebook 輸出一致

Notebook 內交互：

- `群組清單` -> `ad_groups`
- 其他所有工作表 -> `ad_members`
- 每張成員表都加上一個 `BG = 工作表名稱`
- `ADAccount` 轉成大寫，作為後續與 `users`、`role_user` 連接的主 key

前幾個工作表與列數：

- `群組清單`: 1500
- `其他`: 12557
- `ICTBG`: 5370
- `IABG`: 4511
- `PSBG`: 4080
- `Global MFG`: 3689
- `CORP`: 3543
- `FMBG`: 3015
- `IT`: 2886
- `CPBG`: 1942

關鍵用途：

- 提供 AD 帳號屬於哪些群組
- 提供群組的 BG/BU 背景
- 作為輸出檔的主體起點，因為最終查詢是從 `ad_members` 出發

## 主要關聯鍵

- `users.Account = ad_members.ADAccount`
- `role_user.User = ad_members.ADAccount`
- `servers."Application(Server Group)" = role_user.Role`

可以整理成下面這條資料流：

`User_Roles.csv` -> `roles` -> `role_user`

`Users.csv` -> `users`

`Server_Profiles.csv` -> `servers`

`groups_LTW_all.xlsx` -> `ad_groups` + `ad_members`

`ad_members` + `users` + `role_user` + `servers` -> `ad_user_vm_mapping.xlsx`

## 最終輸出檔

Notebook 會產生：

- `ddp.db`
  - 中繼 SQLite 資料庫
- `ad_user_vm_mapping.xlsx`
  - 最終交付的映射報表

輸出欄位包含：

- `AD Account`
- `AD Name (Chinese Name)`
- `FirstName`
- `LastName`
- `Mail`
- `BG`
- `BU`
- `Role`
- `NB Hostname`
- `Group Owner`
- `Group Name`
- `NAS Folder Name`
- `VM HostName`
- `Host IP`
- `NEW VM`
- `User Roles`
- `Application`
- `Template Name`
- `Location`

目前資料夾現況：

- 找不到 `ddp.db`
- 找不到 `ad_user_vm_mapping.xlsx`
- 找不到 `delta_tickets_clean.json`

這表示目前資料夾保留的是來源資料與 notebook，但不是一個可直接完整重跑的最終輸出狀態。

## 資料流對照圖

以下整理「`AD 群組/` -> `Mapping ADGroup、Zentera/`」之間，目前可以確認的資料流。

```text
[Active Directory / LDAP]
    |
    | 由 `AD 群組/fetch_ad_info.py` 直連 DC 查詢
    | 輸入：Kerberos ticket 或 AD_USER / AD_PASSWORD
    v
[`fetch_ad_info.py --all-groups --filter ... --output groups.xlsx`]
    |
    | 產出格式：
    |   Sheet 1: 群組清單
    |     欄位 = 群組名稱 / 說明 / 管理者 / 成員數 / BG
    |   Sheet 2..N: 各 BG tab
    |     欄位 = 群組 / AD Account / CN / Mail / BU
    v
[`groups_LTW_all.xlsx`]
    |
    | 被 `ddp_analysis.ipynb` 載入
    | `群組清單` -> `ad_groups`
    | 其餘 BG sheets -> 合併成 `ad_members`
    v
[SQLite: `ddp.db`]
    |
    | 同時匯入另外 3 份外部資料
    |
    | 1. `User_Roles_202603231446.csv`
    |    -> `roles`
    |    -> 拆解逗號分隔使用者後，展開成 `role_user`
    |
    | 2. `Users_202603231447.csv`
    |    -> 正規化欄位名、帳號轉大寫、部分姓名對調修正
    |    -> `users`
    |
    | 3. `Server_Profiles_202603231446.csv`
    |    -> `servers`
    |
    | 4. `groups_LTW_all.xlsx`
    |    -> `ad_groups`
    |    -> `ad_members`
    |
    | 5. `delta_tickets_clean.json`
    |    -> 原本預計匯入 `tickets`
    |    -> 但目前 notebook 內匯入程式碼已被註解
    v
[`ddp_analysis.ipynb` 最終查詢]
    |
    | Join 關係：
    |   `ad_members.ADAccount = users.Account`
    |   `ad_members.ADAccount = role_user.User`
    |   `role_user.Role = servers."Application(Server Group)"`
    |
    | 產出欄位：
    |   AD Account / AD Name (Chinese Name) / FirstName / LastName / Mail
    |   BG / BU / Role / NB Hostname / Group Owner / Group Name
    |   NAS Folder Name / VM HostName / Host IP / NEW VM
    |   User Roles / Application / Template Name / Location
    v
[`ad_user_vm_mapping.xlsx`]
```

### 來源與責任邊界

- `fetch_ad_info.py` 可以明確對應的輸入來源，是 `groups_LTW_all.xlsx` 這種 AD 群組 Excel；它不會產生 `User_Roles_202603231446.csv`、`Users_202603231447.csv`、`Server_Profiles_202603231446.csv` 這 3 份 CSV。
- `groups_LTW_all.xlsx` 的實際 sheet 結構，和 `fetch_ad_info.py` 內 `save_xlsx()` 寫出的模板一致，因此高度推定它是由這支腳本產生，或至少是由同一套輸出規格產生。
- `User_Roles_202603231446.csv`、`Users_202603231447.csv`、`Server_Profiles_202603231446.csv` 比較像是從 Zentera 平台匯出的原始資料，再由 notebook 匯入 SQLite。
- `delta_tickets_clean.json` 與 `fetch_ad_info.py` 的關係是「可作為 `--input` 的輸入」，不是它的輸出；而在目前這份 notebook 中，`tickets` 匯入流程又被註解掉，所以不屬於當前主資料流。

### 最精簡版本

```text
AD / LDAP
  -> fetch_ad_info.py
  -> groups_LTW_all.xlsx
  -> ddp_analysis.ipynb
  -> SQLite: ad_groups + ad_members

Zentera 匯出 CSV
  -> ddp_analysis.ipynb
  -> SQLite: roles + role_user + users + servers

SQLite 各表 Join
  -> ad_user_vm_mapping.xlsx
```

## Review 重點與風險

### 1. `tickets` 相關流程目前不可重現

Notebook 第 1 個主要程式 cell 中，`delta_tickets_clean.json` 的匯入被註解掉；但第 7 與第 13 個 code cell 仍然會查 `tickets` table。

影響：

- 在全新執行環境下，若先前沒有殘留 `ddp.db`，這兩個 cell 很可能失敗
- notebook 螢幕輸出中的 `tickets: 15 rows`，代表它依賴過去某次執行留下的狀態

結論：

- 這是目前最明顯的可重現性缺口

### 2. 最終輸出會因 VM 對應造成列數膨脹

最終查詢從 `ad_members` 出發，再 left join `role_user` 與 `servers`。若同一個 AD 帳號同時有多個 role，或同一個 role 對到多台 VM，輸出列數就會放大。

觀察：

- `ad_members` 為 54,664 筆
- 最終輸出 `ad_user_vm_mapping.xlsx` 為 89,032 筆

這通常不是 bug，而是 join 粒度改變造成的正常結果；但如果報表閱讀者以為「一人一列」，就會誤解資料。

### 3. `Role` 欄位不是直接來源資料，而是從 Hostname 推導

最終輸出中的 `Role` 欄位，是從 `VM HostName` 以正則式 `([A-Za-z]{2})\\d+$` 擷取出尾碼前兩個英文字母。

影響：

- 這個 `Role` 其實不是原始 DDP Role
- 若 Hostname 格式不符合預期，該欄位會變成空值

### 4. `User_Roles` 的欄位語意與實際內容有落差

原始 CSV 表頭是 `User`，但 notebook 以位置直接改名為 `Users`，並假設內容可能是逗號分隔的多人字串。

影響：

- 這段邏輯本身可以運作
- 但報表維護者若只看原始檔表頭，會誤以為它保證一列只對一位使用者

### 5. `Users` 姓名對調修正帶有特定資料假設

Notebook 用 `LastName` 長度是否為 1 來判斷姓名是否填反，這對常見中文姓名很實用，但本質上仍是 heuristic。

影響：

- 對大多數資料應該有效
- 若未來遇到特殊命名規則，可能誤判

## 結論

這份 notebook 本質上是一個「帳號/群組/角色/VM 對應整理器」，適合用來回答以下問題：

- 某位 AD 使用者屬於哪些群組？
- 某位使用者有哪些 DDP role？
- 某個 role 對到哪些 VM Host？
- 最終是否能組成一份 onboarding 或權限盤點用的交叉報表？

若要讓它更適合持續使用，最優先應補的是：

1. 明確補回或移除 `tickets` 流程，避免依賴舊的 `ddp.db`
2. 在報表或註解中說明最終輸出不是「一人一列」
3. 將輸入檔需求與執行前置條件寫成固定文件，提升可重現性

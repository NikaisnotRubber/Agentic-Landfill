# AD 使用者 / 群組查詢工具

透過 LDAP 直連 Domain Controller，查詢 Active Directory 使用者資訊與群組成員。

## 前置需求

```bash
pip install ldap3 openpyxl
```

- **ldap3**：LDAP 連線必要套件
- **openpyxl**：輸出 Excel（`.xlsx`）時需要

## 環境設定

工具預設使用目前登入的 Kerberos ticket（Windows 網域環境免設定）。若需指定帳號密碼，設定以下環境變數：

| 變數 | 說明 | 預設值 |
|------|------|--------|
| `AD_DC` | Domain Controller 主機名 | `TWTPEDCS02` |
| `AD_BASE_DN` | LDAP 搜尋根 | `DC=delta,DC=corp` |
| `AD_USER` | 連線帳號（留空則用 Kerberos） | 空 |
| `AD_PASSWORD` | 連線密碼 | 空 |

## 用法

### 查詢使用者基本資訊

```bash
python fetch_ad_info.py --account JIAHUA.WU
```

輸出欄位：AD Account、CN、Mail、部門、主管、工號、BG、BU

### 查詢使用者所屬群組

```bash
python fetch_ad_info.py --account JIAHUA.WU --groups
```

### 印出使用者所有 AD 屬性（除錯用）

```bash
python fetch_ad_info.py --account JIAHUA.WU --all-attrs
```

### 查詢單一群組成員

```bash
python fetch_ad_info.py --group G-Delta-rollout_admin
```

### 列出所有群組

```bash
# 列出全部
python fetch_ad_info.py --all-groups

# 用 CN pattern 過濾（支援萬用字元 *）
python fetch_ad_info.py --all-groups --filter "G-Delta*"
```

### 輸出群組清單 + 成員到 Excel

```bash
python fetch_ad_info.py --all-groups --filter "G-Delta*" --output groups.xlsx
```

Excel 包含：
- **群組清單** sheet：群組名稱、說明、管理者、成員數、BG
- **依 BG 分 tab**：各 BG 的群組成員明細（AD Account、CN、Mail、BU）

### 批次查詢工單帳號

從工單 JSON 批次查詢帳號資訊：

```bash
python fetch_ad_info.py --input delta_tickets_clean.json --output ad_info.json
```

工單 JSON 格式（每筆需有 `requester` 欄位）：

```json
[
  { "requester": "JIAHUA.WU ...", ... },
  ...
]
```

## 輸出格式

| `--output` 副檔名 | 格式 |
|------------------|------|
| `.xlsx` | Excel（多 sheet） |
| `.json` | JSON（UTF-8） |
| 不指定 | 僅印至 terminal |

## 已知限制

- AD 分頁查詢每頁 500 筆，可突破 1000 筆上限
- 僅查詢直屬群組（`memberOf`），不遞迴展開巢狀群組
- Windows cp950 終端若顯示亂碼，請確認 Python >= 3.7（已強制 UTF-8 輸出）

# VM 查詢鏈與申請人身分（Phase 2A）

> **狀態**：Implemented（2026-06-02）  
> **執行清單**：[`plans/2026-06-02-phase-2-todo.md`](../plans/2026-06-02-phase-2-todo.md)

## 決策記錄

| ID | 問題 | 決定 | 日期 |
|----|------|------|------|
| D1 | Excel 異常是否與 Processed flags 一致？ | **是** — Excel 由 `processed.abnormalFlags` 映射 | 2026-06-02 |
| D2 | VM 鏈是否為申請人 → 直屬 manager → manager 的 Zentera Role？ | **是** — `ticket.ad.managerAccount` + `resolveVmHostnameFromManager` | 2026-06-02 |

## VM 查詢鏈

1. 描述內有效 VM → 採用（`resolveVmHostname` / `extractHostnamesFromDescription`）。
2. 否則：LDAP 申請人直屬主管 `managerAccount` → Zentera `User_Roles` → `Server_Profiles` Hostname。
3. 多筆 VM：字母序第一 + `ambiguous-vm-hostname`。
4. 全無：`missing-vm-hostname`。

## 申請人帳號優先序

1. `ticket.ad` LDAP enrich（enriched 或 partial account）。
2. 否則 `resolveIdentityFromDescriptionAndRequester`：
   - 自描述解析 `Account name` / AD 標籤；
   - 若 requester AD 與描述一致（出現在描述或帳號相同）→ 覆寫為 requester 欄位；
3. 無 mail 時：`{adAccount}@deltaww.com`（`applyDefaultMail`）。

## 異常旗標（Processed = Excel）

| Flag | Excel issue |
|------|-------------|
| `missing-ad-account` | AD Account |
| `missing-nb-hostname` | NB Hostname |
| `invalid-vm-hostname` | VM HostName(無效值:…) |
| `missing-vm-hostname` | VM HostName |
| `ambiguous-vm-hostname` | VM HostName(多筆候選) |

實作：`server/ddp/abnormalFlags.ts`、`server/excel/buildDdpExcelRows.ts`。

## 模組

| 模組 | 職責 |
|------|------|
| `extractIdentityFromDescription.ts` | 描述 AD / 中文名 / mail |
| `parseRequesterIdentity.ts` | requester 字串 |
| `resolveIdentityFromDescriptionAndRequester.ts` | Python 合併規則 |
| `resolveProcessedIdentity.ts` | LDAP 優先 + fallback |
| `parseDdpTicket.ts` | 編排 |
| `abnormalFlags.ts` | 共用旗標 |

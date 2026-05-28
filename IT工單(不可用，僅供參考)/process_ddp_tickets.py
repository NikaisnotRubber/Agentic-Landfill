import json
import re
import os
from pathlib import Path
from datetime import datetime

from openpyxl import Workbook
from openpyxl.styles import PatternFill

_USER_INFO_CACHE = {}
_ldap_conn = None

def _get_ldap_conn():
    global _ldap_conn
    if _ldap_conn and _ldap_conn.bound:
        return _ldap_conn
    try:
        from ldap3 import Server, Connection, SASL, GSSAPI
        server = Server(os.getenv("AD_DC", "TWTPEDCS02"), get_info=None)
        _ldap_conn = Connection(server, authentication=SASL, sasl_mechanism=GSSAPI, auto_bind=True)
    except Exception as e:
        print(f"  [AD] LDAP 連線失敗: {e}")
        _ldap_conn = None
    return _ldap_conn

def fetch_user_info(ad_account):
    """透過 LDAP 查詢 AD 使用者的 BU / BG，結果 cache 避免重複查詢。"""
    if not ad_account:
        return {}
    if ad_account in _USER_INFO_CACHE:
        return _USER_INFO_CACHE[ad_account]

    conn = _get_ldap_conn()
    if not conn:
        _USER_INFO_CACHE[ad_account] = {}
        return {}

    try:
        conn.search(
            os.getenv("AD_BASE_DN", "DC=delta,DC=corp"),
            f"(sAMAccountName={ad_account})",
            attributes=["extensionAttribute1", "extensionAttribute2"],
        )
        if conn.entries:
            e = conn.entries[0]
            def _first(attr):
                raw = getattr(e, attr, None)
                val = str(raw.value) if raw and raw.value else ""
                return val.split("/")[0] if "/" in val else val
            result = {"BG": _first("extensionAttribute1"), "BU": _first("extensionAttribute2")}
        else:
            result = {}
    except Exception as ex:
        print(f"  [AD] 查詢 {ad_account} 失敗: {ex}")
        result = {}

    _USER_INFO_CACHE[ad_account] = result
    return result

COLUMNS = [
    "Ticket ID", "異常", "工單狀態", "AD Account", "AD Name (Chinese Name)", "FirstName", "LastName", "Mail",
    "BU", "Role", "NB Hostname", "Group Owner", "Group Name", "NAS Folder Name",
    "VM HostName", "NEW VM", "User Roles", "Application", "Template Name", "Location"
]

NB_HOSTNAME_LENGTH = 11  # 台達 NB 命名規則固定長度

# VM HostName 無效佔位值（大小寫不敏感）
INVALID_VM_HOSTNAMES = {
    "hostname", "localhost", "127.0.0.1", "vm", "none", "na", "n/a", "tbd", "-", "host",
}

AD_ACCOUNT_RE = re.compile(r"(?:使用者帳號|AD帳號|AD Account|帳號)[:：\s]*([A-Za-z0-9._-]+)", re.IGNORECASE)
MAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
NB_HOST_RE = re.compile(
    r"(?:使用者電腦名稱|筆電電腦名稱|NB Hostname|電腦名稱|電腦編號(?:\s*\(NB\))?)[:：\s]*([A-Za-z0-9.-]+)",
    re.IGNORECASE,
)
VM_HOST_RE = re.compile(
    r"(?:VM HostName|連線 DDP 主機名稱|VM 主機名稱|Connect VM|主管或同仁的連線主機|VM)[:：\s]*([A-Za-z0-9.-]+)",
    re.IGNORECASE,
)
CHINESE_NAME_RE = re.compile(r"(?:姓名|Name(?: \(Chinese\)?)?)[:：\s]*([\u4e00-\u9fff·•a-zA-Z\s]+)")


def _extract_mail(text):
    m = MAIL_RE.search(text)
    return m.group(0) if m else ""


def _extract_ad_account(text):
    m = AD_ACCOUNT_RE.search(text)
    return m.group(1).strip() if m else ""


def _split_name_from_ad(ad_account):
    """從 AD Account 的 firstname.lastname 格式拆出 FirstName / LastName。"""
    if ad_account and "." in ad_account:
        parts = ad_account.split(".")
        return parts[0].strip().title(), parts[-1].strip().title()
    return "", ""


def _split_chinese_name(chinese_name):
    """中文姓名：第一個字為姓（LastName），其餘為名（FirstName）。"""
    if chinese_name and len(chinese_name) > 1:
        return chinese_name[1:], chinese_name[0]  # FirstName, LastName
    return "", ""


def parse_requester(requester_text):
    normalized = requester_text.strip() if requester_text else ""
    out = {
        "AD Account": "",
        "AD Name (Chinese Name)": "",
        "Mail": "",
    }
    if not normalized:
        return out

    out["Mail"] = _extract_mail(normalized)

    # 常見格式：ADACCOUNT 中文名
    m = re.search(r"([A-Za-z0-9._-]+)\s+([\u4e00-\u9fff·•]{2,})$", normalized)
    if m:
        out["AD Account"] = m.group(1).strip()
        out["AD Name (Chinese Name)"] = m.group(2).strip()
        return out

    # fallback：第一個 token 當 AD Account
    parts = normalized.split()
    if parts:
        out["AD Account"] = parts[0].strip()
    chinese = re.search(r"[\u4e00-\u9fff·•]{2,}", normalized)
    if chinese:
        out["AD Name (Chinese Name)"] = chinese.group(0)
    return out


def normalize_text(text):
    text = text.replace("\n", " ")
    text = text.replace("：", ":")
    # 只切獨立數字編號如 '1.'，不切 'TWCL1NB51363.'
    text = re.sub(r"(?<![A-Za-z0-9])(\d+)\.(?![A-Za-z0-9])", r" \1. ", text)
    text = re.sub(r"([\u4e00-\u9fff])([A-Za-z0-9])", r"\1 \2", text)
    text = re.sub(r"([A-Za-z0-9])([\u4e00-\u9fff])", r"\1 \2", text)
    return text


def extract_from_text(text):
    out = {
        "AD Account": "",
        "AD Name (Chinese Name)": "",
        "FirstName": "",
        "LastName": "",
        "Mail": "",
        "BU": "",
        "Role": "",
        "NB Hostname": "",
        "Group Owner": "",
        "Group Name": "",
        "NAS Folder Name": "",
        "VM HostName": "",
        "NEW VM": "",
        "User Roles": "",
        "Application": "",
        "Template Name": "",
        "Location": "",
    }

    if not text:
        return out

    text = normalize_text(text)

    out["AD Account"] = _extract_ad_account(text)
    out["Mail"] = _extract_mail(text)

    m = NB_HOST_RE.search(text)
    if m:
        nb_val = m.group(1).strip().rstrip(".,;:\\")
        out["NB Hostname"] = nb_val[:NB_HOSTNAME_LENGTH] if len(nb_val) >= NB_HOSTNAME_LENGTH else nb_val

    m = VM_HOST_RE.search(text)
    if m:
        out["VM HostName"] = m.group(1).strip().rstrip(".,;:\\")

    # Fallback: 帳號關鍵字前的 token
    if not out["AD Account"]:
        m = re.search(r"([A-Za-z0-9._-]+)\s*\(?帳號\)?", text)
        if m:
            out["AD Account"] = m.group(1)

    return out


def process_tickets(input_file, output_file):
    path = Path(input_file)
    if not path.exists():
        raise FileNotFoundError(f"找不到 {input_file}")

    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    wb = Workbook()
    ws = wb.active
    ws.title = "待處理"          # 第一頁：Open / Onhold
    ws.append(COLUMNS)

    ws_closed = wb.create_sheet("Closed")
    ws_closed.append(COLUMNS)

    ws_all = wb.create_sheet("All")  # 最後一頁：全部存底
    ws_all.append(COLUMNS)

    header_fill = PatternFill(start_color="FFEBF4F4", end_color="FFEBF4F4", fill_type="solid")
    alt_fill = PatternFill(start_color="FFDCE6F1", end_color="FFDCE6F1", fill_type="solid")
    abnormal_fill = PatternFill(start_color="FFFFC7CE", end_color="FFFFC7CE", fill_type="solid")
    pending_fill = PatternFill(start_color="FFFFFF00", end_color="FFFFFF00", fill_type="solid")

    def apply_header_fill(sheet):
        for col in range(1, len(COLUMNS) + 1):
            cell = sheet.cell(row=1, column=col)
            cell.fill = header_fill if col <= 3 else alt_fill

    apply_header_fill(ws)
    apply_header_fill(ws_closed)
    apply_header_fill(ws_all)

    for idx, item in enumerate(data, start=1):
        desc = item.get("short_description", "")
        parsed = extract_from_text(desc)

        requester_data = parse_requester(item.get("requester", ""))
        requester_ad = requester_data.get("AD Account", "")
        desc_lower = desc.lower() if desc else ""

        # 第一順位用 requester：AD Account 有比對到才套用
        if requester_ad:
            requester_match = (
                requester_ad.lower() in desc_lower
                or parsed.get("AD Account", "").lower() == requester_ad.lower()
            )
            if requester_match:
                parsed["AD Account"] = requester_data["AD Account"]
                if requester_data.get("AD Name (Chinese Name)"):
                    parsed["AD Name (Chinese Name)"] = requester_data["AD Name (Chinese Name)"]
                if requester_data.get("Mail"):
                    parsed["Mail"] = requester_data["Mail"]

        # 姓名拆分：優先用中文名，否則從 AD Account 點號切
        chinese_name = parsed["AD Name (Chinese Name)"]
        if chinese_name:
            parsed["FirstName"], parsed["LastName"] = _split_chinese_name(chinese_name)
        else:
            parsed["FirstName"], parsed["LastName"] = _split_name_from_ad(parsed.get("AD Account", ""))

        # 若無 Mail，從 AD Account 補 deltaww email
        if not parsed.get("Mail") and parsed.get("AD Account"):
            parsed["Mail"] = f"{parsed['AD Account']}@deltaww.com"

        # 從內部 API 補 BU
        if parsed.get("AD Account"):
            user_info = fetch_user_info(parsed["AD Account"])
            if not parsed.get("BU"):
                parsed["BU"] = user_info.get("BU", "")

        # VM HostName 無效佔位值清除並標異常
        vm_val = parsed.get("VM HostName", "")
        if vm_val and vm_val.lower() in INVALID_VM_HOSTNAMES:
            parsed["VM HostName"] = ""
            parsed["_vm_invalid"] = vm_val  # 記錄原始值供 print 使用

        # 檢查必填欄位（AD Name 為選填，常因工單格式不一無法解析）
        required_missing = [
            key for key in ["AD Account", "NB Hostname"]
            if not parsed.get(key)
        ]
        if parsed.get("_vm_invalid"):
            required_missing.append(f"VM HostName(無效值:{parsed['_vm_invalid']})")

        ticket_id = str(item.get("id", ""))
        ticket_url = f"https://ithelpdesk.deltaww.com/WorkOrder.do?woMode=viewWO&woID={ticket_id}" if ticket_id else ""

        abnormal_flag = ""
        abnormal_hyperlink = ""
        if required_missing:
            if ticket_id:
                abnormal_flag = "檢查"
                abnormal_hyperlink = ticket_url

        print(
            f"#{idx:>3} [{item.get('id')}] "
            f"user={parsed['AD Account'] or '?':20s} "
            f"ad_name={parsed['AD Name (Chinese Name)'] or '?':6s} "
            f"nb={parsed['NB Hostname'] or '?':12s} "
            f"vm={parsed['VM HostName'] or '?':15s} "
            + (f"[!] missing: {required_missing}" if required_missing else "[ok]")
        )

        row = [
            item.get("id", ""),
            abnormal_flag,
            item.get("status", ""),
            parsed["AD Account"],
            parsed["AD Name (Chinese Name)"],
            parsed["FirstName"],
            parsed["LastName"],
            parsed["Mail"],
            parsed["BU"],
            parsed["Role"],
            parsed["NB Hostname"],
            "G-Delta-rollout_admin",
            "",  # Group Name 先留空
            parsed["NAS Folder Name"],
            parsed["VM HostName"],
            parsed["NEW VM"],
            parsed["User Roles"],
            parsed["Application"],
            parsed["Template Name"],
            parsed["Location"],
        ]
        status = item.get("status", "")
        is_pending = status in {"Open", "Onhold"}
        status_col = COLUMNS.index("工單狀態") + 1

        def write_row(sheet, with_pending_fill=False):
            sheet.append(row)
            cur_row = sheet.max_row
            # Ticket ID 加連結
            if ticket_url:
                id_cell = sheet.cell(row=cur_row, column=1)
                id_cell.hyperlink = ticket_url
                id_cell.style = "Hyperlink"
            if with_pending_fill:
                sheet.cell(row=cur_row, column=status_col).fill = pending_fill
            if abnormal_flag and abnormal_hyperlink:
                cell = sheet.cell(row=cur_row, column=2)
                cell.hyperlink = abnormal_hyperlink
                cell.value = item.get("subject", "檢查")
                cell.style = "Hyperlink"
                cell.fill = abnormal_fill

        # 全部存底
        write_row(ws_all, with_pending_fill=is_pending)

        # 第一頁只放 Open / Onhold
        if is_pending:
            write_row(ws, with_pending_fill=True)

        # Closed → Closed tab
        if status == "Closed":
            write_row(ws_closed)

    # 自動欄寬
    def char_width(s):
        return sum(2 if ord(c) > 127 else 1 for c in s)

    def auto_width(sheet):
        for column_cells in sheet.columns:
            col_letter = column_cells[0].column_letter
            max_len = max(
                (char_width(str(cell.value)) if cell.value is not None else 0)
                for cell in column_cells
            )
            sheet.column_dimensions[col_letter].width = max(min(max_len + 4, 80), 8)

    for sheet in [ws, ws_closed, ws_all]:
        auto_width(sheet)

    pending_count = ws.max_row - 1
    closed_count = ws_closed.max_row - 1

    import tkinter as tk
    from tkinter import messagebox

    while True:
        try:
            wb.save(output_file)
            print(f"\n已產生 {output_file}（待處理 {pending_count} 筆，Closed {closed_count} 筆，共 {len(data)} 筆）")
            break
        except PermissionError:
            print(f"\n[!] {output_file} 被鎖定，彈出提示視窗...")
            root = tk.Tk()
            root.withdraw()
            root.attributes("-topmost", True)
            answer = messagebox.askretrycancel(
                "檔案被鎖定",
                f"無法儲存，請關閉以下檔案後按「重試」：\n\n{output_file}",
                parent=root,
            )
            root.destroy()
            if not answer:
                print("[!] 使用者取消，放棄儲存。")
                break


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="處理 DDP 工單 short_description 到 Excel")
    parser.add_argument("--input", default="delta_tickets_clean.json")
    parser.add_argument("--output", default="ddp_ticket_maintain.xlsx")
    args = parser.parse_args()
    process_tickets(args.input, args.output)

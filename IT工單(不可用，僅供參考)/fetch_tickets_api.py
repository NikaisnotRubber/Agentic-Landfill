import asyncio
import os
import json
import urllib.parse
from pathlib import Path
from dotenv import load_dotenv
from playwright.async_api import async_playwright

load_dotenv()

STATE_FILE = os.getenv("DELTA_STATE_FILE", "delta_sso_state.json")
BASE_URL = os.getenv("DELTA_BASE_URL", "https://ithelpdesk.deltaww.com/WOListView.do")
ORIGINAL_API_URL = os.getenv("DELTA_API_URL", "https://ithelpdesk.deltaww.com/api/v3/requests?input_data=%7B%22list_info%22%3A%7B%22filter_by%22%3A%7B%22id%22%3A%222130%22%7D%2C%22start_index%22%3A1%2C%22sort_field%22%3A%22due_by_time%22%2C%22sort_order%22%3A%22desc%22%2C%22row_count%22%3A25%2C%22fields_required%22%3A%5B%22requester%22%2C%22created_time%22%2C%22dependency_status%22%2C%22subject%22%2C%22notification_status%22%2C%22technician%22%2C%22priority%22%2C%22due_by_time%22%2C%22site%22%2C%22udf_fields.udf_pick_27%22%2C%22is_service_request%22%2C%22has_notes%22%2C%22id%22%2C%22status%22%2C%22group%22%2C%22template%22%2C%22category%22%2C%22short_description%22%2C%22has_attachments%22%2C%22created_time%22%2C%22responded_time%22%2C%22completed_time%22%2C%22resolved_time%22%2C%22due_by_time%22%2C%22is_overdue%22%2C%22is_first_response_overdue%22%2C%22status.in_progress%22%2C%22status.stop_timer%22%2C%22first_response_due_by_time%22%2C%22is_fcr%22%2C%22onhold_scheduler.change_to_status%22%2C%22onhold_scheduler.scheduled_time%22%2C%22onhold_scheduler.held_by%22%2C%22is_read%22%2C%22unreplied_count%22%2C%22cancel_requested_is_pending%22%2C%22lifecycle%22%5D%2C%22get_total_count%22%3Atrue%7D%2C%22for%22%3A%22list_view_filter%22%7D&SUBREQUEST=XMLHTTP")
ID_TRACKER_FILE = os.getenv("DELTA_ID_TRACKER", "last_seen_id.txt")
TARGET_FIELDS = [
    "short_description", "subject", "id", "group",
    "requester", "technician", "created_time", "site", "category", "status"
]


def modify_api_url(url, count=100):
    parsed_url = urllib.parse.urlparse(url)
    query_params = urllib.parse.parse_qs(parsed_url.query)
    if "input_data" not in query_params:
        raise ValueError("API URL 參數中找不到 input_data")

    input_data = json.loads(query_params["input_data"][0])
    input_data["list_info"]["row_count"] = count
    input_data["list_info"]["fields_required"] = TARGET_FIELDS
    input_data["list_info"]["sort_field"] = "created_time"
    input_data["list_info"]["sort_order"] = "desc"

    query_params["input_data"] = [json.dumps(input_data)]
    new_query = urllib.parse.urlencode(query_params, doseq=True)
    return parsed_url._replace(query=new_query).geturl()


def clean_data(raw_requests):
    cleaned_list = []
    for req in raw_requests:
        item = {}
        for field in TARGET_FIELDS:
            val = req.get(field)
            if isinstance(val, dict):
                item[field] = val.get("name") or val.get("display_value") or val
            else:
                item[field] = val
        cleaned_list.append(item)
    return cleaned_list


def check_for_new_tickets(processed_data):
    if not processed_data:
        return []

    latest_id = str(processed_data[0]["id"])
    last_id = ""
    if os.path.exists(ID_TRACKER_FILE):
        with open(ID_TRACKER_FILE, "r", encoding="utf-8") as f:
            last_id = f.read().strip()

    new_tickets = []
    if latest_id != last_id:
        if last_id == "":
            print(f"[!] 第一次執行，記錄初始工單 ID: {latest_id}")
            new_tickets = [processed_data[0]]
        else:
            found = False
            for ticket in processed_data:
                if str(ticket["id"]) == last_id:
                    found = True
                    break
                new_tickets.append(ticket)
            if not found:
                print(f"[!] 警告：last_seen_id={last_id} 不在本批次中，可能 --count 太小，建議加大。")
                new_tickets = []  # 保守起見不誤報
            else:
                print(f"[!!] 發現新工單！共有 {len(new_tickets)} 筆新進案件。")

        with open(ID_TRACKER_FILE, "w", encoding="utf-8") as f:
            f.write(latest_id)
    else:
        print("[*] 檢查完畢：目前沒有新工單。")

    return new_tickets


def save_to_csv(records, output_path):
    if not records:
        print("沒資料可寫入")
        return
    keys = list(records[0].keys())
    with open(output_path, "w", newline="", encoding="utf-8-sig") as f:
        import csv
        writer = csv.DictWriter(f, fieldnames=keys)
        writer.writeheader()
        writer.writerows(records)
    print(f"已輸出 {len(records)} 筆資料到 {output_path}")


def save_to_excel(records, output_path):
    try:
        from openpyxl import Workbook
    except ImportError:
        raise RuntimeError("請先安裝 openpyxl: python -m pip install openpyxl")
    if not records:
        print("沒資料可寫入")
        return
    headers = list(records[0].keys())
    wb = Workbook()
    ws = wb.active
    ws.title = "WorkOrders"
    ws.append(headers)
    for r in records:
        ws.append([r.get(h, "") for h in headers])
    wb.save(output_path)
    print(f"已輸出 {len(records)} 筆資料到 {output_path}")


async def do_login(p):
    """開有界面的瀏覽器，等使用者手動登入後儲存 session。"""
    print("[*] Session 過期，開啟瀏覽器請手動登入...")
    browser = await p.chromium.launch(headless=False)
    context = await browser.new_context()
    page = await context.new_page()
    await page.goto(BASE_URL, timeout=60000)
    print("[*] 請在瀏覽器中完成 SSO 登入，完成後回到這裡按任意鍵...")
    import msvcrt
    msvcrt.getwch()
    await context.storage_state(path=STATE_FILE)
    print(f"[*] Session 已存至 {STATE_FILE}")
    await browser.close()


async def run_fetch(count=100, output="delta_tickets_clean.json", technician_filter=None):
    target_api_url = modify_api_url(ORIGINAL_API_URL, count=count)

    async with async_playwright() as p:
        # 若無 state file 或內容無效，先登入
        state_path = Path(STATE_FILE)
        state_valid = False
        if state_path.exists():
            try:
                json.loads(state_path.read_text(encoding="utf-8"))
                state_valid = True
            except (json.JSONDecodeError, ValueError):
                print(f"[!] {STATE_FILE} 內容無效，重新登入...")
        if not state_valid:
            await do_login(p)

        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(storage_state=STATE_FILE)
        page = await context.new_page()

        print("[*] 正在前往首頁檢查 Session...")
        await page.goto(BASE_URL, timeout=60000)
        if "WOListView.do" not in page.url:
            await browser.close()
            await do_login(p)
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(storage_state=STATE_FILE)
            page = await context.new_page()
            await page.goto(BASE_URL, timeout=60000)

        print("[*] 正在請求 API 資料...")
        result = await page.evaluate(f"async () => (await fetch('{target_api_url}')).json()")

        # 401 → session token 過期，重新登入後 retry 一次
        is_401 = (
            "requests" not in result
            and any(
                msg.get("status_code") == 401
                for msg in result.get("response_status", {}).get("messages", [])
            )
        )
        if is_401:
            print("[!] API 回傳 401，Session token 已失效，重新登入...")
            await browser.close()
            await do_login(p)
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(storage_state=STATE_FILE)
            page = await context.new_page()
            await page.goto(BASE_URL, timeout=60000)
            result = await page.evaluate(f"async () => (await fetch('{target_api_url}')).json()")

        if "requests" not in result:
            raise RuntimeError("API 沒回 requests 資料: " + json.dumps(result)[:1000])

        raw_data = result["requests"]
        processed_data = clean_data(raw_data)

        if technician_filter:
            processed_data = [item for item in processed_data if str(item.get("technician", "")).strip() == technician_filter.strip()]
            print(f"[*] 依 technician 過濾: {technician_filter}，剩下 {len(processed_data)} 筆")

        new_tickets = check_for_new_tickets(processed_data)
        for t in new_tickets:
            print(f" >> [新工單 {t['id']}] 主旨: {t['subject']} (申請人: {t['requester']})")

        with open(output, "w", encoding="utf-8") as f:
            json.dump(processed_data, f, ensure_ascii=False, indent=2)
        print(f"[*] 總計 {len(processed_data)} 筆資料已存至 {output}")

        await browser.close()


def main():
    global STATE_FILE
    import argparse
    parser = argparse.ArgumentParser(description="使用 delta API 抓工單")
    parser.add_argument("--count", type=int, default=100)
    parser.add_argument("--output", default="delta_tickets_clean.json")
    parser.add_argument("--storage-state", default=STATE_FILE)
    parser.add_argument("--technician", default="", help="過濾 technician，比如 JIAHUA.WU 吳家驊")
    args = parser.parse_args()

    STATE_FILE = args.storage_state
    if not Path(STATE_FILE).exists():
        print(f"[!] storage state file not found: {STATE_FILE}. 會先嘗試登入，但可能失敗")

    asyncio.run(run_fetch(count=args.count, output=args.output, technician_filter=args.technician or None))


if __name__ == "__main__":
    main()

"""
Delta SSO 登入工具
==================
開啟有介面的瀏覽器，等待手動完成 SSO 登入後儲存 session。
之後 fetch_tickets_api.py 會直接吃這個 session，不需要重新登入。

用法：
    python login.py
"""

import asyncio
import os
from pathlib import Path
from dotenv import load_dotenv
from playwright.async_api import async_playwright

load_dotenv()

STATE_FILE = os.getenv("DELTA_STATE_FILE", "delta_sso_state.json")
BASE_URL = os.getenv("DELTA_BASE_URL", "https://ithelpdesk.deltaww.com/WOListView.do")


async def login():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context()
        page = await context.new_page()

        print(f"[*] 開啟瀏覽器，前往 {BASE_URL}")
        await page.goto(BASE_URL, timeout=60000)
        print("[*] 請在瀏覽器中完成 SSO 登入...")
        print("[*] 登入完成後，回到這個視窗按任意鍵儲存 Session")

        import msvcrt
        msvcrt.getwch()

        await context.storage_state(path=STATE_FILE)
        print(f"\n[OK] Session 已儲存至 {STATE_FILE}")
        await browser.close()


if __name__ == "__main__":
    asyncio.run(login())

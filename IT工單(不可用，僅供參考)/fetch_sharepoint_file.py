"""
用 Playwright 登入 Delta SharePoint 並下載指定 Excel 檔案。
第一次會開啟瀏覽器讓你手動登入，之後 cookie 會存在 sp_state.json 供自動重用。
"""
import asyncio
import os
from pathlib import Path
from playwright.async_api import async_playwright

SP_STATE_FILE = "sp_state.json"
SP_SITE = "https://deltao365.sharepoint.com/sites/DDP125"
FILE_UNIQUE_ID = "3EBC0414-BB1C-4788-A97F-8EB7B78F889F"
DOWNLOAD_URL = f"{SP_SITE}/_layouts/15/download.aspx?UniqueId={FILE_UNIQUE_ID}"
OUTPUT_FILE = "VM_PhaseI_Rollout_Schedule.xlsx"


async def run():
    async with async_playwright() as p:
        has_state = Path(SP_STATE_FILE).exists()

        # 第一次：開 UI 瀏覽器讓使用者手動登入
        browser = await p.chromium.launch(headless=has_state)
        context = await browser.new_context(
            storage_state=SP_STATE_FILE if has_state else None,
            accept_downloads=True,
        )
        page = await context.new_page()

        if not has_state:
            print("[*] 首次執行：請在瀏覽器中完成登入，登入後等待頁面載入完成...")
            await page.goto(SP_SITE, timeout=120000)
            # 等使用者登入，直到網址穩定在 SharePoint 站台
            await page.wait_for_url("**/sites/DDP125**", timeout=120000)
            print("[*] 登入成功，儲存 session...")
            await context.storage_state(path=SP_STATE_FILE)

        print(f"[*] 開始下載: {DOWNLOAD_URL}")
        async with page.expect_download(timeout=60000) as dl_info:
            try:
                await page.goto(DOWNLOAD_URL)
            except Exception:
                pass  # 直接觸發下載的 URL 會讓 goto 拋出，屬正常行為
        download = await dl_info.value
        await download.save_as(OUTPUT_FILE)
        print(f"[OK] 檔案已下載: {OUTPUT_FILE}")

        await browser.close()


if __name__ == "__main__":
    asyncio.run(run())

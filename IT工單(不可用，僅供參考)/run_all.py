"""
DDP 工單自動化完整流程
======================
Step 1: 從 IT Helpdesk 抓取最新工單 (fetch_tickets_api.py)
Step 2: 解析工單並輸出 Excel   (process_ddp_tickets.py)

設定方式：複製 .env.example → .env，修改 TECHNICIAN 與 EXCEL_OUTPUT。
"""

import subprocess
import sys
import os
import json
from pathlib import Path
from datetime import datetime

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# ── 設定（優先讀 .env，否則用預設值）────────────────────────────────────────
TECHNICIAN   = os.getenv("TECHNICIAN", "")          # 負責人過濾，留空則抓全部
TICKET_COUNT = 100                                   # 每次抓幾筆
TICKETS_JSON = "delta_tickets_clean.json"
EXCEL_OUTPUT = os.getenv("EXCEL_OUTPUT", "ddp_ticket_maintain.xlsx")
# ─────────────────────────────────────────────────────────────────────────────

PYTHON = sys.executable
BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def banner(step, title):
    print(f"\n{'='*60}", flush=True)
    print(f"  Step {step}: {title}", flush=True)
    print(f"{'='*60}", flush=True)


def run(cmd, desc):
    print(f"\n[執行] {desc}", flush=True)
    print(f"[CMD]  {' '.join(cmd)}\n", flush=True)
    result = subprocess.run(cmd, cwd=BASE_DIR)
    if result.returncode != 0:
        print(f"\n[ERROR] Step 失敗，中止流程 (return code {result.returncode})")
        sys.exit(result.returncode)


def session_valid():
    p = Path(BASE_DIR) / "delta_sso_state.json"
    if not p.exists():
        return False
    try:
        json.loads(p.read_text(encoding="utf-8"))
        return True
    except (json.JSONDecodeError, ValueError):
        return False


def main():
    print(f"\n{'#'*60}", flush=True)
    print(f"  DDP 工單自動化  |  {datetime.now().strftime('%Y-%m-%d %H:%M')}", flush=True)
    print(f"{'#'*60}", flush=True)

    # ── Step 0: 確認 Session ─────────────────────────────────────────────────
    if not session_valid():
        banner(0, "SSO Session 無效，先執行登入")
        run([PYTHON, "login.py"], "login.py")

    # ── Step 1: 抓工單 ───────────────────────────────────────────────────────
    banner(1, "從 IT Helpdesk 抓取工單")
    cmd = [
        PYTHON, "fetch_tickets_api.py",
        "--count", str(TICKET_COUNT),
        "--output", TICKETS_JSON,
    ]
    if TECHNICIAN:
        cmd += ["--technician", TECHNICIAN]
    run(cmd, "fetch_tickets_api.py")

    # ── Step 2: 解析 → Excel ─────────────────────────────────────────────────
    banner(2, "解析工單並輸出 Excel")
    run([PYTHON, "process_ddp_tickets.py", "--input", TICKETS_JSON, "--output", EXCEL_OUTPUT], "process_ddp_tickets.py")

    print(f"\n{'#'*60}", flush=True)
    print(f"  Done! Output: {EXCEL_OUTPUT}", flush=True)
    print(f"{'#'*60}\n", flush=True)


if __name__ == "__main__":
    main()

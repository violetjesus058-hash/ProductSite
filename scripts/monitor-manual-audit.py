#!/usr/bin/env python3
"""Monitor the manual product-audit queue on a user's local computer.

The monitor does not fabricate reviews. It reads the durable audit log and state,
refreshes the next-review queue, and flags a stale heartbeat so the operator can
resume the browser review from the last saved sourceProductId.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PRODUCTS = ROOT / "scripts" / "kakobuy-full-products.json"
LOG = ROOT / "scripts" / "manual-product-review-log.md"
STATE = ROOT / "scripts" / "audit-progress.json"
QUEUE_SCRIPT = ROOT / "scripts" / "init-audit-progress.py"
NEXT_BATCH = ROOT / "scripts" / "audit-next-batch.md"


def now() -> datetime:
    return datetime.now(timezone.utc)


def parse_time(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def reviewed_ids() -> set[str]:
    if not LOG.exists():
        return set()
    return {value for value in re.findall(r"Source product ID:\s*`([^`]+)`", LOG.read_text(encoding="utf-8"))}


def refresh_state() -> dict:
    completed = subprocess.run([sys.executable, str(QUEUE_SCRIPT)], check=True, capture_output=True, text=True)
    state = json.loads(STATE.read_text(encoding="utf-8"))
    state["heartbeatAt"] = now().isoformat(timespec="seconds").replace("+00:00", "Z")
    state["reviewedSourceProductIds"] = sorted(reviewed_ids())
    if state.get("remainingUniqueSourceProducts") == 0:
        state["status"] = "complete"
        state["completedAt"] = state.get("completedAt") or state["heartbeatAt"]
    else:
        state["status"] = "active"
    state["lastMessage"] = "Progress refreshed from manual-product-review-log.md"
    STATE.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    NEXT_BATCH.write_text(
        "# Next Manual Audit Batch\n\n"
        f"Generated at: `{state['heartbeatAt']}`\n\n"
        f"Status: **{state['status']}**\n\n"
        f"Progress: **{state['reviewedUniqueSourceProducts']} / {state['totalUniqueSourceProducts']} unique products reviewed** "
        f"({state['remainingUniqueSourceProducts']} remaining).\n\n"
        "The queue below is generated from the current review log. Review one source product, append its result to "
        "`manual-product-review-log.md`, add an override only when needed, then let the next heartbeat refresh this file.\n\n"
        "```text\n" + completed.stdout.strip() + "\n```\n",
        encoding="utf-8",
    )
    return state


def report(state: dict, stale_after: int) -> bool:
    heartbeat = parse_time(state.get("heartbeatAt"))
    age = int((now() - heartbeat).total_seconds()) if heartbeat else None
    stale = age is not None and age > stale_after and state.get("status") != "complete"
    next_item = state.get("nextReview") or {}
    print(
        f"[{now().isoformat(timespec='seconds')}] status={state.get('status')} "
        f"reviewed={state.get('reviewedUniqueSourceProducts')}/{state.get('totalUniqueSourceProducts')} "
        f"remaining={state.get('remainingUniqueSourceProducts')} "
        f"heartbeat_age={age if age is not None else 'unknown'}s "
        f"next={next_item.get('sourceProductId', 'none')}"
    )
    if stale:
        print("WARNING: the review heartbeat is stale; resume from audit-next-batch.md and append the next result to the review log.")
    if state.get("status") == "complete":
        print("Audit complete: all unique source products have review entries. Monitoring will stop.")
    return stale


def main() -> None:
    parser = argparse.ArgumentParser(description="Monitor and resume the Kakobuy manual audit queue.")
    parser.add_argument("--interval", type=int, default=180, help="Seconds between checks; default: 180.")
    parser.add_argument("--stale-after", type=int, default=420, help="Heartbeat age that counts as interrupted; default: 420.")
    parser.add_argument("--once", action="store_true", help="Refresh and report once, then exit.")
    args = parser.parse_args()

    while True:
        state = refresh_state()
        report(state, args.stale_after)
        if args.once or state.get("status") == "complete":
            return
        time.sleep(max(30, args.interval))


if __name__ == "__main__":
    main()

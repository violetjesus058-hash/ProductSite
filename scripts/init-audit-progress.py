#!/usr/bin/env python3
"""Initialize or refresh the durable manual-audit progress state."""

from __future__ import annotations

import json
import re
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PRODUCTS = ROOT / "scripts" / "kakobuy-full-products.json"
LOG = ROOT / "scripts" / "manual-product-review-log.md"
STATE = ROOT / "scripts" / "audit-progress.json"


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def load_products() -> list[dict]:
    return json.loads(PRODUCTS.read_text(encoding="utf-8"))


def reviewed_ids_from_log() -> set[str]:
    if not LOG.exists():
        return set()
    text = LOG.read_text(encoding="utf-8")
    return {value for value in re.findall(r"Source product ID:\s*`([^`]+)`", text)}


def build_queue(products: list[dict], reviewed: set[str]) -> list[dict]:
    grouped: dict[str, dict] = {}
    for item in products:
        source_id = str(item.get("sourceProductId") or "").strip()
        if not source_id:
            continue
        entry = grouped.setdefault(
            source_id,
            {
                "sourceProductId": source_id,
                "name": item.get("name") or item.get("catalogName") or f"Product {source_id}",
                "category": item.get("category") or "ACC",
                "subCategory": item.get("subCategory") or "Selection",
                "priceGroupCount": 0,
                "productIds": [],
                "images": item.get("images", [])[:3],
            },
        )
        entry["priceGroupCount"] += 1
        entry["productIds"].append(item.get("id"))

    queue = [item for source_id, item in grouped.items() if source_id not in reviewed]
    queue.sort(key=lambda item: (item["category"], item["subCategory"], item["name"].lower(), item["sourceProductId"]))
    return queue


def main() -> None:
    products = load_products()
    reviewed = reviewed_ids_from_log()
    existing = json.loads(STATE.read_text(encoding="utf-8")) if STATE.exists() else {}
    queue = build_queue(products, reviewed)
    total_sources = len({str(item.get("sourceProductId") or "").strip() for item in products if item.get("sourceProductId")})
    completed = total_sources - len(queue)
    state = {
        "schemaVersion": 1,
        "auditScope": "one review per unique sourceProductId; all price groups for that source are validated together",
        "totalPriceGroupProducts": len(products),
        "totalUniqueSourceProducts": total_sources,
        "reviewedUniqueSourceProducts": completed,
        "remainingUniqueSourceProducts": len(queue),
        "reviewedSourceProductIds": sorted(reviewed),
        "lastReviewedProductId": existing.get("lastReviewedProductId") or (sorted(reviewed)[-1] if reviewed else None),
        "nextReview": queue[0] if queue else None,
        "reviewCount": completed,
        "status": "complete" if not queue else "active",
        "heartbeatAt": utc_now(),
        "lastReviewAt": existing.get("lastReviewAt"),
        "completedAt": existing.get("completedAt") if not queue else None,
        "lastMessage": "Initialized from manual-product-review-log.md",
    }
    STATE.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: state[key] for key in ("totalPriceGroupProducts", "totalUniqueSourceProducts", "reviewedUniqueSourceProducts", "remainingUniqueSourceProducts", "status", "nextReview")}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Rebuild the frontend catalog as one product card per source product/style."""
from __future__ import annotations

import json
import re
import hashlib
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PRODUCTS_TS = ROOT / "client/src/data/products.ts"
OUTPUT_TS = PRODUCTS_TS


def parse_products() -> tuple[str, list[dict], str]:
    text = PRODUCTS_TS.read_text(encoding="utf-8")
    start = text.index("export const products")
    opening = text.index("= [", start) + 2
    ending = text.index("] as Product[]", opening)
    products = json.loads(text[opening : ending + 1])
    assertion_end = text.index("as Product[];", ending) + len("as Product[];")
    footer_start = text.index("\n", assertion_end) + 1
    return text[:opening], products, text[footer_start:]


def split_variant(value: object) -> tuple[str, str]:
    raw = str(value or "").strip()
    if not raw:
        return "", ""
    parts = re.split(r"[;:|]", raw, maxsplit=1)
    style = parts[0].strip()
    option = parts[1].strip() if len(parts) > 1 else ""
    return style, option


def rebuild(products: list[dict]) -> list[dict]:
    groups: dict[tuple[str, str], list[tuple[dict, str, str]]] = defaultdict(list)
    no_style: list[dict] = []
    for product in products:
        source_id = str(product.get("sourceProductId") or product.get("id") or "").strip()
        variants = product.get("sizes") or []
        if not variants:
            no_style.append(product)
            continue
        for variant in variants:
            style, option = split_variant(variant)
            if style:
                groups[(source_id, style.casefold())].append((product, style, option))

    rebuilt: list[dict] = []
    for (source_id, style_key), entries in groups.items():
        base = min(entries, key=lambda item: (float(item[0].get("price") or 0), item[0].get("id", "")))[0]
        styles = {style for _, style, _ in entries}
        style_label = sorted(styles, key=lambda value: (len(value), value.casefold()))[0]
        options = sorted({option for _, _, option in entries if option}, key=lambda value: value.casefold())
        prices = [float(item[0].get("price") or 0) for item in entries if item[0].get("price") is not None]
        sku_ids = []
        for product, _, _ in entries:
            for sku_id in product.get("sourceSkuIds") or []:
                if sku_id not in sku_ids:
                    sku_ids.append(sku_id)
        item = dict(base)
        slug = re.sub(r"[^a-z0-9]+", "-", style_label.casefold()).strip("-") or "style"
        digest = hashlib.sha1(style_label.encode("utf-8")).hexdigest()[:8]
        item["id"] = f"kb-{source_id}-style-{slug}-{digest}"
        item["styleKey"] = style_label
        item["styleLabel"] = style_label
        item["sizes"] = options
        item["price"] = min(prices) if prices else base.get("price", 0)
        item["referencePrice"] = item["price"]
        item["sourceSkuIds"] = sku_ids
        item["stock"] = "In stock" if any(product.get("stock") == "In stock" for product, _, _ in entries) else base.get("stock", "Check availability")
        item["reviewNote"] = ((base.get("reviewNote") or "") + " Style-level regrouped from source SKU variants.").strip()
        rebuilt.append(item)

    # Preserve records that have no variant metadata so they remain discoverable.
    for product in no_style:
        item = dict(product)
        item["styleKey"] = ""
        item["styleLabel"] = ""
        rebuilt.append(item)
    return sorted(rebuilt, key=lambda item: (item.get("category", ""), str(item.get("catalogName", "")).casefold(), float(item.get("price") or 0), item.get("id", "")))


def main() -> None:
    prefix, products, suffix = parse_products()
    rebuilt = rebuild(products)
    header = "export type Product = { id: string; name: string; catalogName: string; category: string; subCategory: string; styleKey?: string; styleLabel?: string; reviewStatus?: \"reviewed\" | \"suspected\" | \"unreviewed\"; reviewNote?: string; brand: string; price: number; referencePrice: number | null; currency: string; description: string; sizes: string[]; colors: string[]; stock: string; shop: string; shopUrl: string; url: string; platformLinks?: Record<string, string>; images: string[]; tags: string[]; collectedAt: string; sourceProductId?: string; sourceSkuIds?: string[]; priceRmb?: number | null; priceCheckedAt?: string }\n"
    serialized = json.dumps(rebuilt, ensure_ascii=False, separators=(",", ":"))
    body = "export const products: Product[] = JSON.parse(" + json.dumps(serialized, ensure_ascii=False) + ") as Product[];\n"
    OUTPUT_TS.write_text(header + body + suffix, encoding="utf-8")
    print(f"Rebuilt {len(rebuilt)} Style-level products from {len(products)} price-level products")
    print(f"Unique sources: {len({item.get('sourceProductId') for item in rebuilt})}")


if __name__ == "__main__":
    main()

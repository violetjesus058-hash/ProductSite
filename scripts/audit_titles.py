import json
import re
from pathlib import Path

text = Path("client/src/data/products.ts").read_text(encoding="utf-8")
start = text.index("export const products: Product[] = [") + len("export const products: Product[] = ")
end = text.index("] as Product[];", start) + 1
items = json.loads(text[start:end])

generic = re.compile(r"^(?:High[- ]Quality|High[- ]Quality Fashion|REP High[- ]Quality|High[- ]Quality Apparel|High[- ]Quality Versatile|Fashion|Catalog Item|Kakobuy Product)(?:\s+[A-Za-z]+)?(?:\s+\d+)?$", re.I)
size_only = re.compile(r"^(?:[*]?\d+[-–]\d+|\d+[-–]\d+\s*(?:Pants|Shirt|Clothing|Apparel)?)$", re.I)
lengths = [len(str(item.get("catalogName") or item.get("name") or "")) for item in items]
print(json.dumps({
    "count": len(items),
    "avgLength": round(sum(lengths) / len(lengths), 2),
    "over42": sum(length > 42 for length in lengths),
    "over56": sum(length > 56 for length in lengths),
    "generic": sum(bool(generic.match(str(item.get("catalogName") or ""))) for item in items),
    "sizeOnly": sum(bool(size_only.match(str(item.get("catalogName") or ""))) for item in items),
    "samples": [{
        "id": item.get("id"),
        "title": item.get("catalogName"),
        "name": item.get("name"),
        "category": item.get("category"),
        "subCategory": item.get("subCategory"),
        "brand": item.get("brand"),
        "tags": item.get("tags", [])[:5]
    } for item in items[:12]]
}, indent=2, ensure_ascii=False))

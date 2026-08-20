import json
import re
from pathlib import Path

root = Path('/home/ubuntu/product-catalog-site')
generator = root / 'scripts/generate-kakobuy-full-products.py'
rows = json.loads((root / 'scripts/ai-title-accepted.json').read_text(encoding='utf-8'))
ordered = {}
for row in rows:
    source_id = str(row.get('sourceProductId', ''))
    title = str(row.get('title', '')).strip()
    if source_id and title and source_id not in ordered:
        ordered[source_id] = title
manual = {
    '7545221002': 'Everyday Apparel',
    '7545260684': 'Everyday Hoodie',
    '7554525338': 'Everyday Cap',
    '7576491587': 'Daily Essential Belt',
    '7612177793': 'Daily Essential Belt',
    '7782631879': 'Everyday Jersey',
    '7601623089': 'Gray & Olive Zip-Up Hoodies',
    '7603539016': 'Imagination Graphic Long Sleeve',
    '7603560398': 'Pullover Hoodies - Gray Cream Blue',
    '7603586106': 'Fleetwood Mac Graphic Henleys',
}
ordered.update(manual)
entries = '\n'.join(f"    {source_id!r}: {title!r}," for source_id, title in sorted(ordered.items()))
text = generator.read_text(encoding='utf-8')
pattern = re.compile(r"AI_TITLE_OVERRIDES = \{.*?\n\}\n\nMANUAL_OVERRIDES = \{", re.S)
replacement = f"AI_TITLE_OVERRIDES = {{\n{entries}\n}}\n\nMANUAL_OVERRIDES = {{"
updated, count = pattern.subn(replacement, text, count=1)
if count != 1:
    raise SystemExit('AI_TITLE_OVERRIDES block not found')
generator.write_text(updated, encoding='utf-8')
print(json.dumps({'uniqueSourceTitles': len(ordered)}, ensure_ascii=False))

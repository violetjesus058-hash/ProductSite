import json
import re
from collections import Counter
from pathlib import Path

text = Path('client/src/data/products.ts').read_text(encoding='utf-8')
start = text.index('export const products: Product[] = [') + len('export const products: Product[] = ')
end = text.index('] as Product[];', start) + 1
products = json.loads(text[start:end])
category_words = r'Pants|Jeans|Shorts|Trousers|Hoodie|Jersey|Shirt|Sweater|Jacket|Shoes?|Sneakers?|Boots?|Bag|Wallet|Belt|Cap|Hat|Socks?|Underwear|Watch|Perfume|Phone Case|Accessory'
model_prefix = re.compile(r'^(?:[A-Z]{1,8}\d{1,6}|\d{1,8}[A-Z]{1,8}\d*|[A-Z0-9]{2,}[-_.]\d+)(?:\s+|[-_])', re.I)
model_suffix = re.compile(r'\b[A-Z]{1,8}\d{1,6}\s+(?:' + category_words + r')\b', re.I)
code_only = re.compile(r'^(?:[A-Z]{1,8}\d{1,6}|\d{1,8}[A-Z]{1,8}\d*|[A-Z0-9]{2,}[-_.]\d+)$', re.I)
rows = []
for p in products:
    title = str(p.get('catalogName') or p.get('name') or '').strip()
    if model_prefix.search(title) or model_suffix.search(title) or code_only.fullmatch(title):
        rows.append({
            'id': p.get('id'),
            'sourceProductId': p.get('sourceProductId'),
            'title': title,
            'category': p.get('category'),
            'subCategory': p.get('subCategory'),
            'images': p.get('images', [])[:4],
        })
report = {
    'total': len(products),
    'matched': len(rows),
    'byCategory': Counter(r['category'] for r in rows),
    'bySubCategory': Counter(f"{r['category']}/{r['subCategory']}" for r in rows),
    'examples': rows[:500],
}
Path('scripts/model-category-title-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'total': len(products), 'matched': len(rows), 'byCategory': report['byCategory']}, ensure_ascii=False))
for row in rows[:80]:
    print(f"{row['id']}\t{row['category']}/{row['subCategory']}\t{row['title']}")

import json
import re
from collections import Counter
from pathlib import Path

text = Path('client/src/data/products.ts').read_text(encoding='utf-8')
start = text.index('export const products: Product[] = [') + len('export const products: Product[] = ')
end = text.index('] as Product[];', start) + 1
products = json.loads(text[start:end])
model_category = re.compile(r'^(?:[A-Z]{1,8}\d{1,6}|\d{1,8}[A-Z]{1,8}\d*|[A-Z0-9]{2,}[-_.]\d+)(?:\s+|[-_])(?:Pants|Jeans|Shorts|Trousers|Hoodie|Jersey|Shirt|Sweater|Jacket|Shoes?|Sneakers?|Boots?|Bag|Wallet|Belt|Cap|Hat|Socks?|Underwear|Watch|Perfume|Accessory)(?:\s+(?:S-XL|S-L|M-XXL|\d+[-–]\d+))?$', re.I)
code_only = re.compile(r'^(?:[A-Z]{2,}[._-]?\d{2,}[A-Z0-9-]*|\d{2,}[A-Z]{1,8}\d*)$', re.I)
size_only = re.compile(r'^\*?\s*\d+\s*[-–]\s*\d+(?:\s+\d+)?(?:\s+[A-Z]{1,5})?$', re.I)
contact = re.compile(r'whatsapp|pls\s+contact|pls\s+add|size\s+recommendation|please\s+contact', re.I)
checks = Counter()
examples = {}
for p in products:
    title = str(p.get('catalogName') or '').strip()
    flags = []
    if model_category.fullmatch(title): flags.append('model_plus_category')
    if code_only.fullmatch(title): flags.append('code_only')
    if size_only.fullmatch(title): flags.append('size_only')
    if contact.search(title): flags.append('contact_residue')
    if title.endswith(('…', '...')): flags.append('truncated')
    if len(title) > 42: flags.append('over_42_chars')
    if re.search(r'[\u4e00-\u9fff]', title): flags.append('non_english')
    for flag in flags:
        checks[flag] += 1
        examples.setdefault(flag, []).append({'id': p.get('id'), 'title': title, 'category': p.get('category'), 'subCategory': p.get('subCategory')})
report = {'total': len(products), 'hardIssueCards': len({row['id'] for rows in examples.values() for row in rows}), 'checks': dict(checks), 'examples': examples}
Path('scripts/three-pass-title-quality.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'total': len(products), 'hardIssueCards': report['hardIssueCards'], 'checks': dict(checks)}, ensure_ascii=False))
for flag, rows in examples.items():
    for row in rows[:10]: print(flag, row['id'], row['title'])

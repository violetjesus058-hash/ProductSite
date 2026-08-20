import json
import re
from collections import Counter, defaultdict
from pathlib import Path

text = Path('client/src/data/products.ts').read_text(encoding='utf-8')
start = text.index('export const products: Product[] = [') + len('export const products: Product[] = ')
end = text.index('] as Product[];', start) + 1
products = json.loads(text[start:end])

patterns = {
    'code_only': re.compile(r'^[A-Z]{2,}[._-]?\d{2,}[A-Z0-9-]*$', re.I),
    'sku_like': re.compile(r'^(?:[A-Z]{1,5}\d{2,}|\d{2,}[A-Z]{1,5}\d*|[A-Z]{1,5}[-_.]\d{2,}[A-Z0-9-]*)$', re.I),
    'size_only': re.compile(r'^\*?\s*\d+\s*[-–]\s*\d+(?:\s+\d+)?(?:\s+[A-Z]{1,5})?$', re.I),
    'contact_residue': re.compile(r'whatsapp|pls\s+contact|pls\s+add|size\s+recommendation|please\s+contact', re.I),
    'truncated': re.compile(r'[.…]$'),
    'generic_weak': re.compile(r'^(?:product|item|apparel|accessory|high[- ]?quality|fashion|classic|versatile|premium|everyday|layering|warm-weather|daily essential)(?:\s+(?:product|item|apparel|accessory|fashion|classic|versatile|premium|shirt|pants|shoes?|belt|bag|hoodie|sweater|jacket|set))?$', re.I),
}

by_category = defaultdict(Counter)
issues = []
for item in products:
    title = str(item.get('catalogName') or item.get('name') or '').strip()
    flags = [name for name, pattern in patterns.items() if pattern.search(title)]
    category = item.get('category') or 'unknown'
    for flag in flags:
        by_category[category][flag] += 1
    if flags:
        issues.append({'id': item.get('id'), 'sourceProductId': item.get('sourceProductId'), 'title': title, 'category': category, 'subCategory': item.get('subCategory'), 'flags': flags})

report = {
    'total': len(products),
    'issueCards': len(issues),
    'issueCounts': Counter(flag for issue in issues for flag in issue['flags']),
    'byCategory': {key: dict(value) for key, value in sorted(by_category.items())},
    'examples': issues[:120],
}
report['issueCounts'] = dict(report['issueCounts'])
Path('scripts/title-audit-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({key: report[key] for key in ('total', 'issueCards', 'issueCounts', 'byCategory')}, ensure_ascii=False, indent=2))
print('FIRST_ISSUES')
for issue in issues[:40]:
    print(f"{issue['id']}\t{issue['category']}/{issue['subCategory']}\t{issue['title']}\t{','.join(issue['flags'])}")

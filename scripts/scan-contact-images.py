from __future__ import annotations

import concurrent.futures
import json
import re
import subprocess
from pathlib import Path

PROJECT = Path('/home/ubuntu/product-catalog-site')
DATA = PROJECT / 'client/src/data/products.ts'
ASSETS = Path('/home/ubuntu/webdev-static-assets')
OUT = PROJECT / 'scripts/contact-image-scan.jsonl'

refs = sorted(set(re.findall(r'"/manus-storage/([^" ]+)"', DATA.read_text(encoding='utf-8'))))
asset_map = {p.name: p for p in ASSETS.joinpath('product-images').glob('*') if p.is_file()}
phone_re = re.compile(r'(?:\+?\d[\d\s().-]{6,}\d)')
keyword_re = re.compile(r'whats?app|contact\s+(?:us|me|customer|service)|customer\s+service|add\s+(?:our|me)|telegram|wechat|\b(?:wx|wa)\b|discounts?|product\s+links?', re.I)

def scan(item: tuple[int, str]):
    index, name = item
    path = asset_map.get(name) or asset_map.get(name.split('_')[0] + Path(name).suffix)
    if not path:
        return index, None
    try:
        proc = subprocess.run(['tesseract', str(path), 'stdout', '--psm', '11'], capture_output=True, text=True, timeout=20)
        text = ' '.join(proc.stdout.split())
    except Exception:
        return index, None
    phones = phone_re.findall(text)
    keywords = keyword_re.findall(text)
    if phones or keywords:
        return index, {'file': name, 'path': str(path), 'phones': phones, 'keywords': keywords, 'text': text[:1000]}
    return index, None

results = []
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
    for completed, result in enumerate(executor.map(scan, enumerate(refs, 1)), 1):
        index, record = result
        if record:
            results.append(record)
        if completed % 100 == 0:
            print(f'scanned {completed}/{len(refs)} hits={len(results)}', flush=True)

with OUT.open('w', encoding='utf-8') as handle:
    for record in results:
        handle.write(json.dumps(record, ensure_ascii=False) + '\n')
print(json.dumps({'referenced_images': len(refs), 'scanned': len(refs), 'hits': len(results), 'output': str(OUT)}, ensure_ascii=False))

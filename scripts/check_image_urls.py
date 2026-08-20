import concurrent.futures
import json
from pathlib import Path
from urllib.parse import urlparse
import requests

text = Path('client/src/data/products.ts').read_text(encoding='utf-8')
start = text.index('export const products: Product[] = [') + len('export const products: Product[] = ')
end = text.index('] as Product[];', start) + 1
products = json.loads(text[start:end])
rows = []
seen = set()
for product in products:
    images = product.get('images') or []
    url = next((str(item).strip() for item in images if str(item).strip()), '')
    if url and url not in seen:
        seen.add(url)
        rows.append((product['id'], product.get('sourceProductId'), url))

def check(row):
    pid, source, url = row
    if url.startswith('/manus-storage/'):
        return {'id': pid, 'sourceProductId': source, 'url': url, 'status': 200, 'kind': 'local'}
    try:
        response = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'}, stream=True, timeout=(4, 8), allow_redirects=True)
        content_type = response.headers.get('content-type', '')
        status = response.status_code
        response.close()
        kind = 'ok' if 200 <= status < 300 and content_type.lower().startswith('image/') else 'bad'
        return {'id': pid, 'sourceProductId': source, 'url': url, 'status': status, 'contentType': content_type, 'finalUrl': response.url, 'kind': kind}
    except requests.RequestException as exc:
        return {'id': pid, 'sourceProductId': source, 'url': url, 'status': 0, 'kind': 'error', 'error': str(exc)[:180]}

with concurrent.futures.ThreadPoolExecutor(max_workers=24) as pool:
    results = list(pool.map(check, rows))
Path('scripts/image-url-audit.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
from collections import Counter
print(json.dumps({'uniqueFirstImages': len(results), 'statusKinds': Counter(item['kind'] for item in results), 'statusCodes': Counter(str(item['status']) for item in results)}, ensure_ascii=False, default=dict))
for item in results:
    if item['kind'] != 'ok' and item['kind'] != 'local': print(item)

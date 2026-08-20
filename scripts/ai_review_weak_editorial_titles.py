import base64
import json
import os
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests

ROOT = Path('/home/ubuntu/product-catalog-site')
ASSET_DIR = Path('/home/ubuntu/webdev-static-assets/product-images')
text = (ROOT / 'client/src/data/products.ts').read_text(encoding='utf-8')
start = text.index('export const products: Product[] = ') + len('export const products: Product[] = ')
end = text.index('] as Product[];', start) + 1
products = json.loads(text[start:end])
counts = {}
for item in products:
    title = str(item.get('catalogName') or '').strip()
    counts[title] = counts.get(title, 0) + 1
weak_prefix = re.compile(r'^(?:Essential|Everyday|Daily Carry|Daily Essential|Warm-Weather|Classic|Minimalist|Streetwear|Relaxed Fit)\b', re.I)
priority_categories = {'clothing', 'pants', 'shoe'}
items = []
seen = set()
for item in products:
    pid = str(item.get('sourceProductId'))
    if pid in seen:
        continue
    seen.add(pid)
    title = str(item.get('catalogName') or '').strip()
    category = str(item.get('category') or '')
    if category in priority_categories and (weak_prefix.search(title) or counts.get(title, 0) >= 8):
        items.append(item)

api_base = os.environ['OPENAI_API_BASE'].rstrip('/')
api_key = os.environ['OPENAI_API_KEY']
schema = {'type': 'json_schema', 'json_schema': {'name': 'editorial_title', 'strict': True, 'schema': {'type': 'object', 'properties': {'title': {'type': 'string'}, 'confidence': {'type': 'string', 'enum': ['high', 'medium', 'low']}, 'evidence': {'type': 'string'}}, 'required': ['title', 'confidence', 'evidence'], 'additionalProperties': False}}}

def local_image(path):
    if path.startswith('/manus-storage/'):
        key = Path(path).stem.split('_', 1)[0]
        candidates = list(ASSET_DIR.glob(key + '.*'))
        return candidates[0] if candidates else None
    candidate = ROOT / 'client/public' / path.lstrip('/')
    return candidate if candidate.exists() else None

def image_data(item):
    for path in item.get('images', [])[:4]:
        candidate = local_image(path)
        if candidate and candidate.exists():
            suffix = candidate.suffix.lower()
            mime = 'image/png' if suffix == '.png' else 'image/jpeg'
            return f'data:{mime};base64,{base64.b64encode(candidate.read_bytes()).decode("ascii")}'
    return None

def review(item):
    content = [{'type': 'text', 'text': (
        'Name this menswear catalog product using the image and supplied source context. Return a concise English title of 2-5 words and no more than 42 characters. '
        'Use the most specific visible product type, then one verified structure, graphic, use, team, or brand feature. Do not invent color, fabric, quality, performance, season, popularity, reviews, or brand. '
        'Never output a product code, SKU, size, price, or generic title such as Essential Apparel. If uncertain, use a conservative but specific type such as Graphic T-Shirt, Cargo Pants, Low-Top Sneakers, or Football Jersey. '
        f"Current title: {item.get('catalogName')}\nCategory: {item.get('category')}\nSubcategory: {item.get('subCategory')}\nBrand: {item.get('brand')}\nSource title context: {item.get('name')}"
    )}]
    image = image_data(item)
    if image:
        content.append({'type': 'image_url', 'image_url': {'url': image, 'detail': 'auto'}})
    response = requests.post(f'{api_base}/chat/completions', headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}, json={'model': 'gpt-5-mini', 'messages': [{'role': 'system', 'content': 'You are a conservative fashion catalog editor. Output JSON only.'}, {'role': 'user', 'content': content}], 'response_format': schema, 'max_completion_tokens': 180}, timeout=120)
    response.raise_for_status()
    result = json.loads(response.json()['choices'][0]['message']['content'])
    title = re.sub(r'\s+', ' ', result['title']).strip(' -/:')[:42].rstrip(' -/:')
    return {'id': item['id'], 'sourceProductId': item.get('sourceProductId'), 'oldTitle': item.get('catalogName'), 'title': title, 'confidence': result['confidence'], 'evidence': result['evidence']}

results = []
with ThreadPoolExecutor(max_workers=4) as pool:
    future_map = {pool.submit(review, item): item for item in items}
    for future in as_completed(future_map):
        item = future_map[future]
        try:
            results.append(future.result())
        except Exception as exc:
            results.append({'id': item['id'], 'sourceProductId': item.get('sourceProductId'), 'oldTitle': item.get('catalogName'), 'error': str(exc)})
results.sort(key=lambda x: x.get('sourceProductId', ''))
(ROOT / 'scripts/ai-weak-editorial-title-review.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'requested': len(items), 'completed': sum('title' in r for r in results), 'high': sum(r.get('confidence') == 'high' for r in results), 'errors': sum('error' in r for r in results)}, ensure_ascii=False))

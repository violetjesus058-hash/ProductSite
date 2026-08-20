import base64
import json
import os
import re
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests

ROOT = Path('/home/ubuntu/product-catalog-site')
products_text = (ROOT / 'client/src/data/products.ts').read_text(encoding='utf-8')
start = products_text.index('export const products: Product[] = [') + len('export const products: Product[] = ')
end = products_text.index('] as Product[];', start) + 1
products = json.loads(products_text[start:end])
product_by_id = {item['id']: item for item in products}
code_only = re.compile(r'^[A-Z]{2,}[._-]?\d{2,}[A-Z0-9-]*$', re.I)
sku_like = re.compile(r'^(?:[A-Z]{1,5}\d{2,}|\d{2,}[A-Z]{1,5}\d*|[A-Z0-9]{5,})$', re.I)
issues = [
    {'id': item['id'], 'flags': ['identifier-title']}
    for item in products
    if code_only.fullmatch(str(item.get('catalogName', '')).strip())
    or sku_like.fullmatch(str(item.get('catalogName', '')).strip())
]

api_base = os.environ['OPENAI_API_BASE'].rstrip('/')
api_key = os.environ['OPENAI_API_KEY']

schema = {
    'type': 'json_schema',
    'json_schema': {
        'name': 'catalog_title',
        'strict': True,
        'schema': {
            'type': 'object',
            'properties': {
                'title': {'type': 'string'},
                'confidence': {'type': 'string', 'enum': ['high', 'medium', 'low']},
                'reason': {'type': 'string'},
            },
            'required': ['title', 'confidence', 'reason'],
            'additionalProperties': False,
        },
    },
}

def image_data(item):
    for image in item.get('images', [])[:4]:
        path = ROOT / 'client/public' / image.lstrip('/')
        if path.exists():
            mime = 'image/png' if path.suffix.lower() == '.png' else 'image/webp'
            data = base64.b64encode(path.read_bytes()).decode('ascii')
            return f'data:{mime};base64,{data}'
    return None

def one(issue):
    item = product_by_id[issue['id']]
    image = image_data(item)
    content = [{
        'type': 'text',
        'text': (
            'Create a concise English catalog title for this product. Use only visible facts from the image and the supplied catalog context. '
            'Do not invent brand, material, performance, price, popularity, reviews, or season. Do not repeat product codes, SKU strings, size ranges, or contact details. '
            'Prefer 2-5 words, maximum 42 characters. If the image is unclear, use a conservative category + format title. '
            f"Current title: {item.get('catalogName')}\nCategory: {item.get('category')}\nSubcategory: {item.get('subCategory')}\nBrand field: {item.get('brand')}"
        ),
    }]
    if image:
        content.append({'type': 'image_url', 'image_url': {'url': image, 'detail': 'auto'}})
    response = requests.post(
        f'{api_base}/chat/completions',
        headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},
        json={
            'model': 'gpt-5-mini',
            'messages': [
                {'role': 'system', 'content': 'You are a careful product catalog editor. Return JSON only.'},
                {'role': 'user', 'content': content},
            ],
            'response_format': schema,
            'max_completion_tokens': 160,
        },
        timeout=90,
    )
    response.raise_for_status()
    payload = response.json()
    result = json.loads(payload['choices'][0]['message']['content'])
    title = re.sub(r'\s+', ' ', result['title']).strip(' -/:')
    result['title'] = title[:42].rstrip(' -/:')
    result['id'] = item['id']
    result['sourceProductId'] = item.get('sourceProductId')
    result['oldTitle'] = item.get('catalogName')
    return result

results = []
with ThreadPoolExecutor(max_workers=4) as pool:
    futures = [pool.submit(one, issue) for issue in issues]
    for future in as_completed(futures):
        try:
            results.append(future.result())
        except Exception as exc:
            results.append({'error': str(exc)})
results.sort(key=lambda row: row.get('id', ''))
(ROOT / 'scripts/ai-title-review.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'requested': len(issues), 'completed': sum('title' in row for row in results), 'errors': [row for row in results if 'error' in row][:5]}, ensure_ascii=False, indent=2))
